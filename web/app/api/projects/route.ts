import { NextRequest } from "next/server";
import { ensureContract } from "../_utils/openapi-guard";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function GET(request: NextRequest) {
  ensureContract("/api/projects", "GET");
  return proxyRequest(request, "/api/projects", {
    requireAuth: true,
  });
}

export async function POST(request: NextRequest) {
  ensureContract("/api/projects", "POST");
  return proxyRequest(request, "/api/projects", {
    requireAuth: true,
  });
}
