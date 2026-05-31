import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

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

  return proxyRequest(request, `/api/v1/chat/${projectId}/messages`);
}

/**
 * POST /api/chat/{projectId}/messages
 * 发送消息到AI助手 — 直接代理到后端，支持 mode=clarification
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  // Proxy to backend; allow up to 60s for AI generation.
  return proxyRequest(request, `/api/v1/chat/${projectId}/messages`, {
    method: 'POST',
    timeoutMs: 60000, // 60s for AI generation
  });
}
