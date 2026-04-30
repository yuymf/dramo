import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(request, `/api/v1/projects/${projectId}/characters/relations/cleanup`, {
    requireAuth: true,
  });
}
