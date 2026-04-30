import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

// TODO: Add ensureContract once billing routes are in OpenAPI spec
export async function POST(request: NextRequest) {
  return proxyRequest(request, "/api/v1/billing/portal-session", {
    requireAuth: true,
  });
}
