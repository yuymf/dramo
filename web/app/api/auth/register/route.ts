import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/api/v1/auth/register", {
    requireAuth: false,
  });
}
