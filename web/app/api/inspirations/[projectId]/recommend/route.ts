import { NextRequest } from 'next/server';
import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * POST /api/inspirations/{projectId}/recommend
 * 基于完整台本上下文和当前编辑位置进行重上下文精准推荐
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  return proxyRequest(request, `/api/v1/inspirations/${projectId}/recommend`);
}
