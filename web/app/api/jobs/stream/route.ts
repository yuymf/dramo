import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

const backendBaseUrl =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:12321';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: '未认证，请先登录',
        },
      },
      { status: 401 }
    );
  }

  const targetUrl = new URL(`${backendBaseUrl.replace(/\/$/, '')}/api/v1/jobs/stream${request.nextUrl.search}`);

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: 'no-store',
  });

  // Check status before streaming — don't pipe error responses as SSE
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_ERROR',
          message: text ? text.substring(0, 200) : '后端服务不可用',
        },
      },
      { status: response.status >= 500 ? 502 : response.status }
    );
  }

  if (!response.body) {
    const text = await response.text().catch(() => '');
    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_ERROR',
          message: text || '后端服务不可用',
        },
      },
      { status: 502 }
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
