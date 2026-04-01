import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

/**
 * GET /api/chat/{projectId}/messages
 * 获取项目的AI对话历史
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  return proxyRequest(request, `/api/chat/${projectId}/messages`, {
    requireAuth: true,
  });
}

/**
 * POST /api/chat/{projectId}/messages
 * 发送消息到AI助手 — 直接代理到后端，支持 mode=clarification
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const error = validateRouteParam(projectId, "projectId");
  if (error) return error;

  // Use proxyRequest for consistent auth handling
  return proxyRequest(request, `/api/chat/${projectId}/messages`, {
    requireAuth: true,
    method: 'POST',
    timeoutMs: 60000, // 60s for AI generation
  });
}
