import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; frameId: string }> }
) {
  const { projectId, frameId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/storyboard/frames/${frameId}/image`,
    {
      requireAuth: true,
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; frameId: string }> }
) {
  const { projectId, frameId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/storyboard/frames/${frameId}/image`,
    {
      requireAuth: true,
    }
  );
}

