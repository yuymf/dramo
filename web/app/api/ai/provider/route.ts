import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function GET(request: NextRequest) {
  return proxyRequest(request, "/api/ai/provider", {
    requireAuth: true,
  });
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/api/ai/provider", {
    requireAuth: true,
  });
}
