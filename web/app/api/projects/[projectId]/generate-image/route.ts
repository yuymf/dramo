import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export const maxDuration = 100;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(request, `/api/projects/${projectId}/generate-image`, {
    requireAuth: true,
  });
}

