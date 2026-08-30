import type { NextRequest } from "next/server";
import { proxyRequest } from "../_utils/proxy";

/**
 * Local-dev catch-all: /api/foo → Hono /api/v1/foo
 *
 * Production traffic never hits this file — nginx rewrites /api/* to the
 * API container directly. This exists so `npm run dev` has the same path
 * shape as Docker.
 */
export const runtime = "nodejs";
export const maxDuration = 600;

function toBackendPath(segments: string[] | undefined): string {
  const rest = (segments ?? []).filter(Boolean).join("/");
  if (!rest) return "/api/v1";
  if (rest.startsWith("v1/") || rest === "v1") return `/api/${rest}`;
  return `/api/v1/${rest}`;
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, toBackendPath(path));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
