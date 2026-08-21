import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip) {
    return NextResponse.json({ error: '缺少 ip 参数' }, { status: 400 });
  }

  try {
    // Use ping command with 1 packet, 3 second timeout
    const { stdout } = await execAsync(`ping -c 1 -W 3 ${ip}`, { timeout: 5000 });
    
    // Parse ping output to extract latency
    // Example: "64 bytes from 209.33.161.228: icmp_seq=1 ttl=64 time=0.123 ms"
    const timeMatch = stdout.match(/time=([0-9.]+)/);
    
    if (timeMatch && timeMatch[1]) {
      const latency = parseFloat(timeMatch[1]);
      return NextResponse.json({ ip, latency, online: true });
    } else {
      return NextResponse.json({ ip, latency: null, online: false });
    }
  } catch (error) {
    // Ping failed - server is unreachable
    return NextResponse.json({ ip, latency: null, online: false });
  }
}
