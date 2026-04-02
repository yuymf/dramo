import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * PATCH /api/chat/{projectId}/sessions/{sessionId} — Rename session
 * DELETE /api/chat/{projectId}/sessions/{sessionId} — Delete session
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const { projectId, sessionId } = await params;
  const error = validateRouteParam(projectId, 'projectId') || validateRouteParam(sessionId, 'sessionId');
  if (error) return error;

  return proxyRequest(request, `/api/chat/${projectId}/sessions/${sessionId}`, {
    requireAuth: true,
    method: 'PATCH',
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const { projectId, sessionId } = await params;
  const error = validateRouteParam(projectId, 'projectId') || validateRouteParam(sessionId, 'sessionId');
  if (error) return error;

  return proxyRequest(request, `/api/chat/${projectId}/sessions/${sessionId}`, {
    requireAuth: true,
    method: 'DELETE',
  });
}
