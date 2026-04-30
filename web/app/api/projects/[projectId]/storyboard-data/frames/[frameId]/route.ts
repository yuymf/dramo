import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; frameId: string }> }
) {
  const { projectId, frameId } = await params;
  return proxyRequest(request, `/api/v1/projects/${projectId}/storyboard-data/frames/${frameId}`, {
    requireAuth: true,
  });
}
