import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(
    request,
    `/api/v1/projects/${projectId}/storyboard/frames/images`,
    {
      requireAuth: true,
    }
  );
}

