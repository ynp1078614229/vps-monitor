import { NextRequest, NextResponse } from 'next/server';
import { removeServer } from '@/lib/store';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = removeServer(id);

  if (!deleted) {
    return NextResponse.json(
      { error: '服务器不存在' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, message: '服务器已删除' });
}
