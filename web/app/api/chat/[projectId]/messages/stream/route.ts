import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * POST /api/chat/{projectId}/messages/stream
 * SSE streaming proxy — forwards stream from backend without buffering.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, 'projectId');
  if (error) return error;

  return proxyRequest(request, `/api/v1/chat/${projectId}/messages`, {
    requireAuth: true,
    method: 'POST',
    timeoutMs: 120000, // 2 minutes for streaming
  });
}
