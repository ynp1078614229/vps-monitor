import { NextRequest, NextResponse } from 'next/server';
import { getServer, updateTrafficSettings, getTrafficUsage } from '@/lib/store';

// GET /api/servers/[id]/traffic - Get traffic usage for a server
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const usage = getTrafficUsage(id);
  
  if (usage.status === 'unlimited' && usage.usedBytes === 0) {
    // Check if server exists
    const server = getServer(id);
    if (!server) {
      return NextResponse.json({ error: '服务器不存在' }, { status: 404 });
    }
  }
  
  return NextResponse.json(usage);
}

// POST /api/servers/[id]/traffic - Update traffic settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { trafficLimitGB, trafficMode, trafficResetDay } = body;
    
    // Validate inputs
    if (trafficLimitGB !== undefined && trafficLimitGB !== null) {
      if (typeof trafficLimitGB !== 'number' || trafficLimitGB < 0) {
        return NextResponse.json(
          { error: '流量限制必须是非负数字' },
          { status: 400 }
        );
      }
    }
    
    if (trafficMode !== undefined && trafficMode !== null) {
      if (trafficMode !== 'down' && trafficMode !== 'both') {
        return NextResponse.json(
          { error: '流量模式必须是 down 或 both' },
          { status: 400 }
        );
      }
    }
    
    if (trafficResetDay !== undefined && trafficResetDay !== null) {
      if (typeof trafficResetDay !== 'number' || trafficResetDay < 1 || trafficResetDay > 28) {
        return NextResponse.json(
          { error: '重置日期必须是 1-28 之间的数字' },
          { status: 400 }
        );
      }
    }
    
    const success = updateTrafficSettings(id, {
      trafficLimitGB: trafficLimitGB || undefined,
      trafficMode: trafficMode || undefined,
      trafficResetDay: trafficResetDay || undefined,
    });
    
    if (!success) {
      return NextResponse.json({ error: '服务器不存在' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: '流量设置已更新' });
  } catch (error) {
    console.error('Failed to update traffic settings:', error);
    return NextResponse.json({ error: '更新流量设置失败' }, { status: 500 });
  }
}
