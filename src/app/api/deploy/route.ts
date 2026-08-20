import { NextRequest, NextResponse } from 'next/server';
import { upsertServer } from '@/lib/store';
import { exec } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execAsync = promisify(exec);

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

// 使用系统 sshpass + ssh 命令执行远程命令
async function execRemote(
  ip: string,
  port: number,
  username: string,
  password: string,
  command: string,
  logs: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  const sshCmd = `sshpass -p '${password.replace(/'/g, "'\\''")}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${port} ${username}@${ip} '${command.replace(/'/g, "'\\''")}'`;
  
  try {
    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 300000 });
    if (stdout) logs.push(stdout.trim());
    return { stdout, stderr, code: 0 };
  } catch (error: any) {
    const code = error.code || 1;
    const stdout = error.stdout || '';
    const stderr = error.stderr || error.message || '';
    if (stdout) logs.push(stdout.trim());
    if (stderr) logs.push(`[stderr] ${stderr.trim()}`);
    return { stdout, stderr, code };
  }
}

// 测试 SSH 连接
async function testSSHConnection(
  ip: string,
  port: number,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(
      `sshpass -p '${password.replace(/'/g, "'\\''")}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${port} ${username}@${ip} 'echo OK'`,
      { timeout: 15000 }
    );
    return { success: true };
  } catch (error: any) {
    const msg = error.stderr || error.message || '';
    if (msg.includes('Permission denied') || msg.includes('password')) {
      return { success: false, error: 'SSH 认证失败，请检查用户名和密码' };
    }
    if (msg.includes('Connection refused')) {
      return { success: false, error: `连接被拒绝，请检查 IP 和端口 (${port})` };
    }
    if (msg.includes('Connection timed out') || msg.includes('ETIMEDOUT')) {
      return { success: false, error: '连接超时，请检查网络和防火墙' };
    }
    if (msg.includes('No route to host')) {
      return { success: false, error: '无法到达目标主机，请检查 IP 地址' };
    }
    return { success: false, error: `SSH 连接失败: ${msg.slice(0, 100)}` };
  }
}

// 后台执行部署（不等待完成）
async function deployInBackground(
  ip: string,
  port: number,
  username: string,
  password: string,
  monitorUrl: string,
  serverId: string,
  secret: string
): Promise<void> {
  const logs: string[] = [];
  
  try {
    // 检测操作系统
    logs.push('[INFO] 检测操作系统...');
    const osResult = await execRemote(ip, port, username, password, 'cat /etc/os-release 2>/dev/null | head -5', logs);
    const isUbuntu = osResult.stdout.toLowerCase().includes('ubuntu');
    const isDebian = osResult.stdout.toLowerCase().includes('debian');
    const isCentOS = osResult.stdout.toLowerCase().includes('centos') || osResult.stdout.toLowerCase().includes('rhel');
    logs.push(`[INFO] 系统: ${isUbuntu ? 'Ubuntu' : isDebian ? 'Debian' : isCentOS ? 'CentOS/RHEL' : '未知'}`);

    // 检查并安装 Node.js
    logs.push('[INFO] 检查 Node.js...');
    const nodeCheck = await execRemote(ip, port, username, password, 'node --version 2>/dev/null || echo "NOT_FOUND"', logs);
    
    if (nodeCheck.stdout.includes('NOT_FOUND')) {
      logs.push('[INFO] 安装 Node.js...');
      if (isUbuntu || isDebian) {
        await execRemote(ip, port, username, password, 
          'curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs', logs);
      } else if (isCentOS) {
        await execRemote(ip, port, username, password,
          'curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && yum install -y nodejs', logs);
      }
    }

    // 创建目录并下载 Agent
    logs.push('[INFO] 部署 Agent...');
    await execRemote(ip, port, username, password, 'mkdir -p /opt/vps-agent', logs);
    await execRemote(ip, port, username, password,
      `curl -sSL -o /opt/vps-agent/vps-monitor.js "${monitorUrl}/agent/vps-monitor.js"`, logs);

    // 创建 systemd 服务
    logs.push('[INFO] 创建系统服务...');
    const serviceContent = `[Unit]
Description=VPS Monitor Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vps-agent
Environment=AGENT_SECRET=${secret}
Environment=SERVER_URL=${monitorUrl}
Environment=SERVER_ID=${serverId}
Environment=REPORT_INTERVAL=5
ExecStart=/usr/bin/node vps-monitor.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`;

    await execRemote(ip, port, username, password,
      `cat > /etc/systemd/system/vps-agent.service << 'AGENTEOF'
${serviceContent}
AGENTEOF`, logs);

    // 启动服务
    logs.push('[INFO] 启动 Agent...');
    await execRemote(ip, port, username, password,
      'systemctl daemon-reload && systemctl enable vps-agent && systemctl restart vps-agent', logs);

    logs.push('[SUCCESS] Agent 部署完成！');
    
    // 注册服务器到存储
    upsertServer({
      id: serverId,
      hostname: serverId,
      ip: ip,
      os: isUbuntu ? 'Ubuntu' : isDebian ? 'Debian' : isCentOS ? 'CentOS' : 'Unknown',
      kernel: '',
      cpuModel: '',
      cpuCores: 0,
      totalMemory: 0,
      totalDisk: 0,
      agentVersion: '1.0.0',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    }, {
      timestamp: Date.now(),
      cpuUsage: 0,
      memoryUsed: 0,
      memoryUsage: 0,
      diskUsed: 0,
      diskUsage: 0,
      networkRxBytes: 0,
      networkTxBytes: 0,
      totalRxBytes: 0,
      totalTxBytes: 0,
      loadAvg1: 0,
      loadAvg5: 0,
      loadAvg15: 0,
      uptime: 0,
    });

  } catch (error: any) {
    logs.push(`[ERROR] 部署失败: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DeployRequest = await request.json();
    const {
      ip,
      port = 22,
      username = 'root',
      password,
      serverId,
      monitorUrl,
    } = body;

    if (!ip || !password) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数: ip, password' },
        { status: 400 }
      );
    }

    const actualMonitorUrl = monitorUrl || `http://${process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'localhost:8080'}`;
    const actualServerId = serverId || `server-${ip.replace(/\./g, '-')}`;
    const secret = process.env.AGENT_SECRET || 'vps-monitor-default-secret';

    // 先测试 SSH 连接
    const connTest = await testSSHConnection(ip, port, username, password);
    if (!connTest.success) {
      return NextResponse.json(
        { success: false, message: connTest.error || 'SSH 连接失败' },
        { status: 400 }
      );
    }

    // SSH 连接成功，启动后台部署
    deployInBackground(ip, port, username, password, actualMonitorUrl, actualServerId, secret).catch(err => {
      console.error('Background deploy error:', err);
    });

    // 立即返回成功
    return NextResponse.json({
      success: true,
      message: 'SSH 连接成功，正在后台部署监控 Agent...',
      serverId: actualServerId,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `部署失败: ${error.message}` },
      { status: 500 }
    );
  }
}
