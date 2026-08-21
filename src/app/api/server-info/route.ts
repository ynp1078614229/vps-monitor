import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  let publicIp = '';
  
  // 尝试获取公网 IP
  try {
    publicIp = execSync('curl -s --max-time 3 ifconfig.me || curl -s --max-time 3 ipinfo.io/ip || curl -s --max-time 3 api.ipify.org', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    // 如果获取失败，尝试其他方式
    try {
      publicIp = execSync('hostname -I | awk \'{print $1}\'', {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
    } catch {
      publicIp = 'localhost';
    }
  }

  // 从环境变量或请求头获取端口
  const port = process.env.PORT || process.env.DEPLOY_RUN_PORT || '8080';
  const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';

  return NextResponse.json({
    publicIp,
    port,
    monitorUrl: `${protocol}://${publicIp}:${port}`,
  });
}
