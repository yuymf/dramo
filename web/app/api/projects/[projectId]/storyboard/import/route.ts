import { NextRequest } from "next/server";
import { proxyRequest, validateRouteParam } from "@/app/api/_utils/proxy";

/**
 * POST /api/projects/{projectId}/storyboard/import
 * 提交剧本文本生成分镜（异步模式，后端立即返回 taskId）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const validationError = validateRouteParam(projectId, "projectId");
  if (validationError) return validationError;

  return proxyRequest(
    request,
    `/api/v1/projects/${projectId}/storyboard/import`,
    {
      // Backend returns 202 + taskId immediately, no long timeout needed
    }
  );
}
