import { NextRequest } from "next/server";
import { proxyRequest, validateRouteParam } from "@/app/api/_utils/proxy";

/**
 * GET /api/tasks/{taskId}
 * 轮询任务状态（用于分镜生成等异步任务）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const validationError = validateRouteParam(taskId, "taskId");
  if (validationError) return validationError;

  return proxyRequest(request, `/api/v1/tasks/${taskId}`);
}
