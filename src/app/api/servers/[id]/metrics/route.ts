import { NextRequest, NextResponse } from 'next/server';
import { getServer, getMetricsHistory, isServerOnline, seedDemoData } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    seedDemoData();

    const { id } = await params;
    const data = getServer(id);

    if (!data) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const limit = 60;
    const metrics = getMetricsHistory(id, limit);

    return NextResponse.json({
      server: {
        id: data.info.id,
        hostname: data.info.hostname,
        ip: data.info.ip,
        os: data.info.os,
        kernel: data.info.kernel,
        cpuModel: data.info.cpuModel,
        cpuCores: data.info.cpuCores,
        totalMemory: data.info.totalMemory,
        totalDisk: data.info.totalDisk,
        agentVersion: data.info.agentVersion,
        firstSeen: data.info.firstSeen,
        lastSeen: data.info.lastSeen,
        online: isServerOnline(data),
      },
      metrics,
    });
  } catch (error) {
    console.error('Server metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
