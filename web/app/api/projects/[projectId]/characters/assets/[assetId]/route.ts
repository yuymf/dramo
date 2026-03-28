import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> }
) {
  const { projectId, assetId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/characters/assets/${assetId}`,
    {
      requireAuth: true,
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> }
) {
  const { projectId, assetId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/characters/assets/${assetId}`,
    {
      requireAuth: true,
    }
  );
}
