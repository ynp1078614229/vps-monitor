import { NextRequest, NextResponse } from 'next/server';
import { upsertServer, getAgentSecret, type ServerInfo, type MetricsRecord } from '@/lib/store';

interface AgentReportPayload {
  serverId: string;
  hostname: string;
  ip: string;
  os: string;
  kernel: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number;
  totalDisk: number;
  agentVersion: string;
  metrics: {
    cpuUsage: number;
    memoryUsed: number;
    memoryUsage: number;
    diskUsed: number;
    diskUsage: number;
    networkRxBytes: number;
    networkTxBytes: number;
    loadAvg1: number;
    loadAvg5: number;
    loadAvg15: number;
    uptime: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const secret = getAgentSecret();
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as AgentReportPayload;

    // Validate required fields
    if (!body.serverId || !body.hostname || !body.metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: serverId, hostname, metrics' },
        { status: 400 }
      );
    }

    const serverInfo: ServerInfo = {
      id: body.serverId,
      hostname: body.hostname,
      ip: body.ip || 'unknown',
      os: body.os || 'unknown',
      kernel: body.kernel || 'unknown',
      cpuModel: body.cpuModel || 'unknown',
      cpuCores: body.cpuCores || 1,
      totalMemory: body.totalMemory || 0,
      totalDisk: body.totalDisk || 0,
      agentVersion: body.agentVersion || '1.0.0',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };

    const metrics: MetricsRecord = {
      timestamp: Date.now(),
      cpuUsage: body.metrics.cpuUsage,
      memoryUsed: body.metrics.memoryUsed,
      memoryUsage: body.metrics.memoryUsage,
      diskUsed: body.metrics.diskUsed,
      diskUsage: body.metrics.diskUsage,
      networkRxBytes: body.metrics.networkRxBytes,
      networkTxBytes: body.metrics.networkTxBytes,
      loadAvg1: body.metrics.loadAvg1,
      loadAvg5: body.metrics.loadAvg5,
      loadAvg15: body.metrics.loadAvg15,
      uptime: body.metrics.uptime,
    };

    const data = upsertServer(serverInfo, metrics);

    return NextResponse.json({
      success: true,
      serverId: data.info.id,
      message: 'Metrics recorded',
    });
  } catch (error) {
    console.error('Agent report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
