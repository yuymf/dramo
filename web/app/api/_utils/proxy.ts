import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:12321";

/** Local-dev proxy timeout — matches nginx proxy_read_timeout (600s). */
const DEFAULT_TIMEOUT_MS = 600_000;

function resolveBackendUrl(targetPath: string, request: Request) {
  const normalizedBase = backendBaseUrl.replace(/\/$/, "");
  const incomingUrl = new URL(request.url);

  const rawTarget = targetPath.startsWith("http")
    ? targetPath
    : `${normalizedBase}/${targetPath.replace(/^\//, "")}`;

  const finalUrl = new URL(rawTarget);

  if (incomingUrl.search) {
    finalUrl.search = incomingUrl.search;
  }

  return finalUrl;
}

interface ProxyOptions {
  method?: string;
  timeoutMs?: number;
}

async function resolveRequestBody(
  request: Request,
  method: string,
  headers: Headers
): Promise<BodyInit | undefined> {
  if (method === "GET" || method === "HEAD") {
    return undefined;
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

  const method = options.method ?? request.method;
  const headers = new Headers();

  const incomingContentType = request.headers.get("content-type");
  if (incomingContentType) {
    headers.set("Content-Type", incomingContentType);
  }

  const body = await resolveRequestBody(request, method, headers);
  const targetUrl = resolveBackendUrl(targetPath, request);

  try {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const backendResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
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
