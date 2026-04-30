import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function GET(request: NextRequest) {
  return proxyRequest(request, "/api/v1/ai/providers", {
    requireAuth: true,
  });
}
