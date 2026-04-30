import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * POST /api/chat/{projectId}/reset
 * Reset chat history — proxies to backend DELETE
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, 'projectId');
  if (error) return error;

  return proxyRequest(request, `/api/v1/chat/${projectId}/reset`, {
    requireAuth: true,
    method: 'POST',
  });
}
