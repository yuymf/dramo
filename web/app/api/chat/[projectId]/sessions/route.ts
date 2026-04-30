import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * GET /api/chat/{projectId}/sessions — List chat sessions
 * POST /api/chat/{projectId}/sessions — Create new session
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, 'projectId');
  if (error) return error;

  return proxyRequest(request, `/api/v1/chat/${projectId}/sessions`, {
    requireAuth: true,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, 'projectId');
  if (error) return error;

  return proxyRequest(request, `/api/v1/chat/${projectId}/sessions`, {
    requireAuth: true,
    method: 'POST',
  });
}
