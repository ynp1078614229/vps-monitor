import { NextResponse } from 'next/server';
import { getAllServers, isServerOnline, seedDemoData } from '@/lib/store';

export async function GET() {
  try {
    seedDemoData();

    const servers = getAllServers().map((data) => ({
      id: data.info.id,
      hostname: data.info.hostname,
      ip: data.info.ip,
      os: data.info.os,
      cpuModel: data.info.cpuModel,
      cpuCores: data.info.cpuCores,
      totalMemory: data.info.totalMemory,
      totalDisk: data.info.totalDisk,
      agentVersion: data.info.agentVersion,
      firstSeen: data.info.firstSeen,
      lastSeen: data.info.lastSeen,
      online: isServerOnline(data),
      latest: data.latest,
    }));

    // Sort: online first, then by hostname
    servers.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.hostname.localeCompare(b.hostname);
    });

    return NextResponse.json({ servers });
  } catch (error) {
    console.error('List servers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
