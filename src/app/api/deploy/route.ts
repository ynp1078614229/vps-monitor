import { NextRequest, NextResponse } from 'next/server';
import { upsertServer } from '@/lib/store';

export const runtime = 'nodejs';

// 动态导入 ssh2 避免 Turbopack 打包问题
async function getSSHClient() {
  const { Client } = await import('ssh2');
  return new Client();
}

interface DeployRequest {
  ip: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  serverId?: string;
  hostname?: string;
  secret?: string;
  monitorUrl?: string;
}

interface DeployResult {
  success: boolean;
  message: string;
  logs: string[];
  serverId?: string;
}

function execSSH(
  conn: any,
  command: string,
  logs: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err: Error | undefined, stream: any) => {
      if (err) {
        reject(err);
        return;
      }

      let output = '';
      let errorOutput = '';

      stream
        .on('close', (code: number) => {
          if (output) logs.push(output.trim());
          if (errorOutput && code !== 0) logs.push(`[stderr] ${errorOutput.trim()}`);
          resolve(output);
        })
        .on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;
        })
        .stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
    });
  });
}

async function deployAgent(params: DeployRequest): Promise<DeployResult> {
  const logs: string[] = [];
  const {
    ip,
    port = 22,
    username,
    password,
    privateKey,
    serverId,
    hostname,
    secret = 'vps-monitor-default-secret',
    monitorUrl,
  } = params;

  return new Promise(async (resolve) => {
    const conn = await getSSHClient();
    const timeout = setTimeout(() => {
      conn.end();
      resolve({
        success: false,
        message: 'SSH 连接超时',
        logs,
      });
    }, 30000);

    conn.on('ready', async () => {
      logs.push('[OK] SSH 连接成功');

      try {
        // 检测操作系统
        const osInfo = await execSSH(conn, 'cat /etc/os-release 2>/dev/null | head -5', logs);
        logs.push(`[INFO] 系统信息: ${osInfo.split('\n')[0] || '未知'}`);

        // 检查 Node.js
        const nodeCheck = await execSSH(conn, 'node --version 2>/dev/null || echo "NOT_FOUND"', logs);
        
        if (nodeCheck.includes('NOT_FOUND')) {
          logs.push('[INFO] 正在安装 Node.js...');
          
          // 检测包管理器
          if (osInfo.includes('Ubuntu') || osInfo.includes('Debian')) {
            await execSSH(conn, 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs', logs);
          } else if (osInfo.includes('CentOS') || osInfo.includes('RHEL') || osInfo.includes('Rocky') || osInfo.includes('AlmaLinux')) {
            await execSSH(conn, 'curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && yum install -y nodejs', logs);
          } else {
            logs.push('[WARN] 未识别的系统，尝试通用安装...');
            await execSSH(conn, 'curl -fsSL https://fnm.vercel.app/install | bash && export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)" && fnm install 20 && fnm use 20', logs);
          }

          const nodeVersion = await execSSH(conn, 'node --version 2>/dev/null || echo "FAILED"', logs);
          if (nodeVersion.includes('FAILED')) {
            clearTimeout(timeout);
            conn.end();
            resolve({
              success: false,
              message: 'Node.js 安装失败',
              logs,
            });
            return;
          }
          logs.push(`[OK] Node.js ${nodeVersion.trim()} 安装成功`);
        } else {
          logs.push(`[OK] Node.js ${nodeCheck.trim()} 已安装`);
        }

        // 获取服务器 hostname 作为默认 ID
        const actualHostname = hostname || (await execSSH(conn, 'hostname', logs)).trim();
        const actualServerId = serverId || actualHostname;

        // 确定监控面板地址
        const actualMonitorUrl = monitorUrl || `http://${process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'localhost:8080'}`;

        // 部署 Agent
        logs.push('[INFO] 正在部署监控 Agent...');
        
        const deployScript = `
mkdir -p /opt/vps-agent && \\
curl -sSL -o /opt/vps-agent/vps-monitor.js ${actualMonitorUrl}/agent/vps-monitor.js && \\
cat > /etc/systemd/system/vps-agent.service << 'AGENTEOF'
[Unit]
Description=VPS Monitor Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vps-agent
Environment=AGENT_SECRET=${secret}
Environment=SERVER_URL=${actualMonitorUrl}
Environment=SERVER_ID=${actualServerId}
Environment=REPORT_INTERVAL=5
ExecStart=/usr/bin/node vps-monitor.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
AGENTEOF
systemctl daemon-reload && \\
systemctl enable vps-agent && \\
systemctl restart vps-agent
`;

        await execSSH(conn, deployScript, logs);
        logs.push('[OK] Agent 服务已启动');

        // 等待几秒后检查状态
        await new Promise((r) => setTimeout(r, 3000));
        
        const status = await execSSH(conn, 'systemctl is-active vps-agent 2>/dev/null', logs);
        if (status.trim() === 'active') {
          logs.push('[OK] Agent 运行正常');
        } else {
          logs.push(`[WARN] Agent 状态: ${status.trim()}`);
        }

        // 检查日志确认数据上报
        const agentLogs = await execSSH(conn, 'journalctl -u vps-agent -n 5 --no-pager 2>/dev/null | tail -5', logs);
        logs.push(`[INFO] Agent 日志: ${agentLogs.split('\n').pop() || '无'}`);

        // 在 store 中注册服务器
        const now = Date.now();
        upsertServer({
          id: actualServerId,
          hostname: actualHostname,
          ip,
          os: osInfo.split('\n').find(l => l.startsWith('PRETTY_NAME'))?.split('=')[1]?.replace(/"/g, '') || '未知',
          kernel: '',
          cpuModel: '',
          cpuCores: 0,
          totalMemory: 0,
          totalDisk: 0,
          agentVersion: '1.0.0',
          firstSeen: now,
          lastSeen: now,
        }, {
          timestamp: now,
          cpuUsage: 0,
          memoryUsage: 0,
          memoryUsed: 0,
          diskUsage: 0,
          diskUsed: 0,
          networkRxBytes: 0,
          networkTxBytes: 0,
          totalRxBytes: 0,
          totalTxBytes: 0,
          loadAvg1: 0,
          loadAvg5: 0,
          loadAvg15: 0,
          uptime: 0,
        });

        clearTimeout(timeout);
        conn.end();
        resolve({
          success: true,
          message: '监控 Agent 部署成功',
          logs,
          serverId: actualServerId,
        });
      } catch (error: unknown) {
        clearTimeout(timeout);
        conn.end();
        const errMsg = error instanceof Error ? error.message : String(error);
        logs.push(`[ERROR] ${errMsg}`);
        resolve({
          success: false,
          message: `部署失败: ${errMsg}`,
          logs,
        });
      }
    });

    conn.on('error', (err: Error) => {
      clearTimeout(timeout);
      logs.push(`[ERROR] SSH 连接失败: ${err.message}`);
      resolve({
        success: false,
        message: `SSH 连接失败: ${err.message}`,
        logs,
      });
    });

    conn.connect({
      host: ip,
      port,
      username,
      password,
      privateKey: privateKey || undefined,
      readyTimeout: 15000,
      algorithms: {
        kex: [
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
        ],
      },
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ip, port, username, password, privateKey, serverId, hostname, secret, monitorUrl } = body as DeployRequest;

    if (!ip || !username || (!password && !privateKey)) {
      return NextResponse.json(
        { error: '请提供 IP、用户名和密码（或私钥）' },
        { status: 400 }
      );
    }

    // 先测试 SSH 连接
    let sshClient: Awaited<ReturnType<typeof getSSHClient>>;
    try {
      sshClient = await getSSHClient();
      await new Promise<void>((resolve, reject) => {
        sshClient.on('ready', () => resolve()).on('error', (err: Error) => reject(err));
        sshClient.connect({
          host: ip,
          port: port || 22,
          username,
          password,
          privateKey,
        });
      });
    } catch (connErr) {
      const errMsg = connErr instanceof Error ? connErr.message : '连接失败';
      return NextResponse.json(
        { error: `SSH 连接失败: ${errMsg}` },
        { status: 400 }
      );
    }

    // SSH 连接成功，关闭测试连接
    sshClient.end();

    // 后台异步执行部署
    setTimeout(() => {
      deployAgent({
        ip,
        port,
        username,
        password,
        privateKey,
        serverId,
        hostname,
        secret,
        monitorUrl,
      }).then((result) => {
        if (result.success) {
          console.log(`[Deploy] 服务器 ${ip} 部署成功: ${result.serverId}`);
        } else {
          console.log(`[Deploy] 服务器 ${ip} 部署失败: ${result.message}`);
        }
      }).catch((err) => {
        console.error(`[Deploy] 服务器 ${ip} 部署异常:`, err);
      });
    }, 0);

    return NextResponse.json({
      success: true,
      message: 'SSH 连接成功，正在后台部署监控 Agent...',
      ip,
    });
  } catch {
    return NextResponse.json(
      { error: '部署请求处理失败' },
      { status: 500 }
    );
  }
}
