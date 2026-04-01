import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';
import type { ChatMessage } from '@/lib/models';

/**
 * GET /api/chat/{projectId}/messages
 * 获取项目的AI对话历史
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.backendToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '未认证，请先登录', retryable: false } },
      { status: 401 }
    );
  }

  return proxyRequest(request, `/api/chat/${projectId}/messages`, {
    requireAuth: true,
  });
}

/**
 * POST /api/chat/{projectId}/messages
 * 发送消息到AI助手（支持附带剧本blocks和JSON上下文）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.backendToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '未认证，请先登录', retryable: false } },
      { status: 401 }
    );
  }

  let body: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    blocks?: Array<{ label: string; text: string }>;
    context?: {
      pageType: string;
      data: object | null;
    };
    stream?: boolean;
    mode?: string;
    selectedOption?: string[] | string;
    messageType?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: '请求体格式无效', retryable: false } },
      { status: 400 }
    );
  }

  if (!body.content || typeof body.content !== 'string') {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: '消息内容不能为空', retryable: false } },
      { status: 400 }
    );
  }

  // Proxy to backend with proper Bearer auth
  try {
    const backendBaseUrl =
      process.env.BACKEND_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:12321';

    const response = await fetch(`${backendBaseUrl}/api/chat/${projectId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.backendToken}`,
      },
      body: JSON.stringify({
        role: body.role,
        content: body.content,
        blocks: body.blocks,
        context: body.context,
        stream: body.stream || false,
        mode: body.mode,
        selectedOption: body.selectedOption,
        messageType: body.messageType,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Backend error: ${response.status} ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();

    return NextResponse.json({
      userMessage: result.userMessage,
      assistantMessage: {
        ...result.assistantMessage,
        suggestedChanges: result.assistantMessage?.suggestedChanges || undefined,
        clarificationComplete: result.assistantMessage?.clarificationComplete || undefined,
      },
    });
  } catch (err) {
    console.error('[POST /api/chat] Backend API error:', err);

    // Only return mock responses in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'AI 服务暂不可用，请稍后重试',
            retryable: true,
          },
        },
        { status: 502 }
      );
    }

    // Development fallback mock
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: body.role,
      content: body.content,
      blocks: body.blocks,
      createdAt: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: `[开发模式] 收到你的消息："${body.content.substring(0, 50)}"。后端服务未连接，这是一个模拟回复。`,
      createdAt: new Date(Date.now() + 1000).toISOString(),
    };

    return NextResponse.json({ userMessage, assistantMessage });
  }
}
