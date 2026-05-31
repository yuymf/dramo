import { NextRequest } from 'next/server';
import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * PATCH /api/projects/{projectId}/script/content
 * 保存用户编辑后的台本内容
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  return proxyRequest(request, `/api/v1/projects/${projectId}/script/content`);
}
