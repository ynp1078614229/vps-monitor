import { NextRequest, NextResponse } from 'next/server';
import { getAllServers, isServerOnline, upsertServer, updateServerRemark } from '@/lib/store';

export async function GET() {
  try {
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
      remark: data.info.remark || '',
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, hostname, ip, remark } = body;

    if (!id || !ip) {
      return NextResponse.json(
        { error: '缺少必填字段: id, ip' },
        { status: 400 }
      );
    }

    // Create a placeholder server entry
    upsertServer(
      {
        id,
        hostname: hostname || id,
        ip,
        os: '未知',
        kernel: '未知',
        cpuModel: '未知',
        cpuCores: 0,
        totalMemory: 0,
        totalDisk: 0,
        agentVersion: '未连接',
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        remark: remark || '',
      },
      {
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
      }
    );

    return NextResponse.json({ success: true, message: '服务器已添加' });
  } catch (error) {
    console.error('Add server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, remark } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少必填字段: id' },
        { status: 400 }
      );
    }

    const updated = updateServerRemark(id, remark || '');
    if (!updated) {
      return NextResponse.json(
        { error: '服务器不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: '备注已更新' });
  } catch (error) {
    console.error('Update remark error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
