import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

// TODO: Add ensureContract once billing routes are in OpenAPI spec
export async function GET(request: NextRequest) {
  return proxyRequest(request, "/api/billing/subscription", {
    requireAuth: true,
  });
}
