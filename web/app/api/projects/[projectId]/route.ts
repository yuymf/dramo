import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_utils/proxy';

/**
 * GET /api/projects/{projectId}
 * 获取项目详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(request, `/api/projects/${projectId}`, {
    requireAuth: true,
  });
}

/**
 * PATCH /api/projects/{projectId}
 * 更新项目信息（包括名称）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(request, `/api/projects/${projectId}`, {
    requireAuth: true,
  });
}

