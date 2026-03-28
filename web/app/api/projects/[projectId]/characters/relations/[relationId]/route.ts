import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; relationId: string }> }
) {
  const { projectId, relationId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/characters/relations/${relationId}`,
    {
      requireAuth: true,
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; relationId: string }> }
) {
  const { projectId, relationId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/characters/relations/${relationId}`,
    {
      requireAuth: true,
    }
  );
}

