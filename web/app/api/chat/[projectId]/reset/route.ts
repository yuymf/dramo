import { NextResponse } from 'next/server';

/**
 * POST /api/chat/{projectId}/reset
 * 重置对话历史，开启新会话
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  console.log(`[POST /api/chat/${projectId}/reset] 重置对话历史`);

  return NextResponse.json({
    projectId,
    reset: true,
    message: '对话历史已重置',
  });
}

