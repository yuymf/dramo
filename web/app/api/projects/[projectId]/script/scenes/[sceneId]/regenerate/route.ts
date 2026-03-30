import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

/**
 * POST /api/projects/{projectId}/script/scenes/{sceneId}/regenerate
 * 重新生成指定场景的内容
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  const { projectId, sceneId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/script/scenes/${sceneId}/regenerate`,
    {
      requireAuth: true,
      timeoutMs: 180000, // 3 minutes for AI generation
    }
  );
}
