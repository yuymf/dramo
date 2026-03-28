import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/characters/relations`,
    {
      requireAuth: true,
    }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(
    request,
    `/api/projects/${projectId}/characters/relations`,
    {
      requireAuth: true,
    }
  );
}
