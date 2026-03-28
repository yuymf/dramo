import { NextRequest } from "next/server";
import { proxyRequest, validateRouteParam } from "@/app/api/_utils/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const error = validateRouteParam(jobId, "jobId");
  if (error) return error;

  return proxyRequest(request, `/api/jobs/${jobId}/cancel`, {
    requireAuth: true,
  });
}
