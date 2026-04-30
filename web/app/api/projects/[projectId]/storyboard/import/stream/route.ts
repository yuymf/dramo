import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// 设置较长的超时时间（Hobby 仅允许 1~300 秒）
export const maxDuration = 300; // 5分钟

/**
 * POST /api/projects/{projectId}/storyboard/import/stream
 * SSE streaming endpoint for progress updates (using POST to send text in body)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '未认证，请重新登录' } },
      { status: 401 }
    );
  }
  
  let text: string;
  try {
    const body = await request.json();
    text = body.text;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: '请求体格式错误' } },
      { status: 400 }
    );
  }
  
  if (!text || text.trim().length === 0) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: '缺少text参数' } },
      { status: 400 }
    );
  }
  
  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:12321';
  const streamUrl = `${backendUrl}/api/v1/projects/${projectId}/storyboard/import/stream`;
  
  try {
    console.log(`[POST /api/projects/${projectId}/storyboard/import/stream] Streaming from backend...`, {
      textLength: text.length,
    });
    
    const backendResponse = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.backendToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`Backend stream error (${backendResponse.status}):`, errorText);
      
      return NextResponse.json(
        { 
          error: {
            code: 'BACKEND_ERROR',
            message: errorText || `后端返回错误: ${backendResponse.status}`,
          }
        },
        { status: backendResponse.status }
      );
    }
    
    // Proxy SSE stream to frontend
    const stream = backendResponse.body;
    if (!stream) {
      return NextResponse.json(
        { error: { code: 'NO_STREAM', message: '后端未返回流' } },
        { status: 500 }
      );
    }
    
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('SSE stream proxy error:', err);
    
    return NextResponse.json(
      { 
        error: {
          code: 'STREAM_ERROR',
          message: err.message || '流代理失败',
        }
      },
      { status: 500 }
    );
  }
}






