import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth/options";

const backendBaseUrl =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:12321";

/**
 * Validate a route parameter to prevent path traversal / SSRF.
 * Returns true if the param is safe (alphanumeric, hyphens, underscores, dots).
 */
const SAFE_PARAM_RE = /^[a-zA-Z0-9_\-\.]+$/;

export function isValidRouteParam(param: string): boolean {
  return SAFE_PARAM_RE.test(param) && !param.includes("..");
}

export function validateRouteParam(param: string, paramName: string): NextResponse | null {
  if (!isValidRouteParam(param)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMETER",
          message: `Invalid ${paramName}`,
          retryable: false,
        },
      },
      { status: 400 }
    );
  }
  return null;
}

function resolveBackendUrl(targetPath: string, request: Request, appendIncomingQuery: boolean) {
  const normalizedBase = backendBaseUrl.replace(/\/$/, "");
  const incomingUrl = new URL(request.url);

  const rawTarget = targetPath.startsWith("http")
    ? targetPath
    : `${normalizedBase}/${targetPath.replace(/^\//, "")}`;

  const finalUrl = new URL(rawTarget);

  if (appendIncomingQuery && incomingUrl.search) {
    const separator = finalUrl.search ? "&" : "?";
    finalUrl.search += `${separator}${incomingUrl.search.slice(1)}`;
  } else if (!appendIncomingQuery && !rawTarget.includes("?") && incomingUrl.search) {
    finalUrl.search = incomingUrl.search;
  }

  return finalUrl;
}

interface ProxyOptions {
  requireAuth?: boolean;
  method?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
  body?: BodyInit | Record<string, unknown> | null;
  appendQuery?: boolean;
  timeoutMs?: number;
}

async function ensureSession(
  requireAuth: boolean | undefined
): Promise<Session | null> {
  const session = await getServerSession(authOptions);

  if (requireAuth && !session?.backendToken) {
    throw new NextResponse(
      JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "未认证，请先登录",
          retryable: false,
        },
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return session;
}

async function resolveRequestBody(
  request: Request,
  method: string,
  explicitBody: ProxyOptions["body"],
  headers: Headers
): Promise<BodyInit | undefined> {
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  if (explicitBody !== undefined) {
    if (
      explicitBody instanceof FormData ||
      explicitBody instanceof Blob ||
      explicitBody instanceof ArrayBuffer ||
      explicitBody instanceof Uint8Array
    ) {
      headers.delete("Content-Type");
      return explicitBody as BodyInit;
    }

    if (typeof explicitBody === "string") {
      return explicitBody;
    }

    headers.set("Content-Type", "application/json");
    return JSON.stringify(explicitBody);
  }

  const originalContentType = request.headers.get("content-type") ?? "";

  if (originalContentType.includes("multipart/form-data")) {
    headers.delete("Content-Type");
    return await request.formData();
  }

  if (originalContentType.includes("application/json")) {
    const raw = await request.text();
    return raw || undefined;
  }

  if (originalContentType.includes("application/x-www-form-urlencoded")) {
    return await request.text();
  }

  if (!originalContentType) {
    const raw = await request.text();
    return raw || undefined;
  }

  headers.set("Content-Type", originalContentType);
  const buffer = await request.arrayBuffer();
  return buffer.byteLength > 0 ? buffer : undefined;
}

export async function proxyRequest(
  request: Request,
  targetPath: string,
  options: ProxyOptions = {}
) {
  // Guard against path traversal in interpolated route parameters
  if (targetPath.includes("..") || targetPath.includes("//") || /%2[eEfF]/i.test(targetPath)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PATH",
          message: "Invalid request path",
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  let session: Session | null = null;
  try {
    session = await ensureSession(options.requireAuth);
  } catch (response) {
    if (response instanceof NextResponse) {
      return response;
    }
    throw response;
  }

  const method = options.method ?? request.method;
  const headers = new Headers(options.headers ?? {});

  if (session?.backendToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.backendToken}`);
  }

  if (!headers.has("Content-Type")) {
    const incomingContentType = request.headers.get("content-type");
    if (incomingContentType) {
      headers.set("Content-Type", incomingContentType);
    }
  }

  const body = await resolveRequestBody(request, method, options.body, headers);
  const targetUrl = resolveBackendUrl(
    targetPath,
    request,
    options.appendQuery ?? false
  );

  try {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 30000; // default 30s
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const backendResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: options.cache ?? "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
      if (["content-type", "content-disposition"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("Cache-Control", "no-store");

    const contentType = backendResponse.headers.get("content-type") ?? "";

    // SSE streaming passthrough — pipe the stream directly to the client
    if (contentType.includes("text/event-stream")) {
      responseHeaders.set("Content-Type", "text/event-stream");
      responseHeaders.set("Cache-Control", "no-cache");
      responseHeaders.set("Connection", "keep-alive");
      return new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        headers: responseHeaders,
      });
    }

    if (contentType.includes("application/json")) {
      // Read body as text first, then parse — avoids double-consumption of response stream
      const text = await backendResponse.text();
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data, {
          status: backendResponse.status,
          headers: responseHeaders,
        });
      } catch {
        return new NextResponse(text, {
          status: backendResponse.status,
          headers: responseHeaders,
        });
      }
    }

    const arrayBuffer = await backendResponse.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: backendResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(
      `[proxyRequest] Failed to proxy ${method} ${targetUrl.toString()}:`,
      error
    );

    const isTimeout = error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      {
        error: {
          code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
          message: isTimeout
            ? "后端服务响应超时，请稍后重试"
            : "后端服务暂不可用，请稍后重试",
          retryable: true,
        },
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}

