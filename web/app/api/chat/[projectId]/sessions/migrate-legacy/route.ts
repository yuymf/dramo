import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * POST /api/chat/{projectId}/sessions/migrate-legacy
 * Migrate orphaned messages into a "历史对话" session.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, 'projectId');
  if (error) return error;

  return proxyRequest(request, `/api/chat/${projectId}/sessions/migrate-legacy`, {
    requireAuth: true,
    method: 'POST',
  });
}
