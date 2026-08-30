import { Hono } from 'hono';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';

const chatSessions = new Hono<AuthEnv>();

const DEFAULT_SESSION_TITLE = '新对话';

function requireUser(c: { get: (key: 'user') => AuthEnv['Variables']['user'] | undefined }) {
  const user = c.get('user');
  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }
  return user;
}

async function requireProjectMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }
  return member;
}

chatSessions.get('/chat/:projectId/sessions', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;

  await requireProjectMember(projectId, userId);

  const sessions = await prisma.chatSession.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return c.json({
    data: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
    })),
  });
});

/**
 * POST /api/chat/:projectId/sessions — Create a new session
 */
chatSessions.post('/chat/:projectId/sessions', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;
  const body = await c.req.json<{ title?: string }>().catch(() => ({} as { title?: string }));

  await requireProjectMember(projectId, userId);

  const session = await prisma.chatSession.create({
    data: {
      projectId,
      title: body.title?.trim() || DEFAULT_SESSION_TITLE,
    },
  });

  return c.json({ data: session }, 201);
});

/**
 * PATCH /api/chat/:projectId/sessions/:sessionId — Rename a session
 */
chatSessions.patch('/chat/:projectId/sessions/:sessionId', async (c) => {
  const projectId = c.req.param('projectId');
  const sessionId = c.req.param('sessionId');
  const userId = requireUser(c).userId;
  const requestId = c.get('requestId');
  const body = await c.req.json<{ title?: string }>().catch(() => ({} as { title?: string }));

  await requireProjectMember(projectId, userId);

  if (!body.title?.trim()) {
    return c.json({
      error: { code: 'INVALID_INPUT', message: 'Title is required', retryable: false },
      requestId,
    }, 400);
  }

  // Bind sessionId to projectId — prevents IDOR
  const existing = await prisma.chatSession.findFirst({
    where: { id: sessionId, projectId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Session not found');
  }

  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { title: body.title.trim() },
  });

  return c.json({ data: session });
});

/**
 * DELETE /api/chat/:projectId/sessions/:sessionId — Delete a session and its messages
 */
chatSessions.delete('/chat/:projectId/sessions/:sessionId', async (c) => {
  const projectId = c.req.param('projectId');
  const sessionId = c.req.param('sessionId');
  const userId = requireUser(c).userId;

  await requireProjectMember(projectId, userId);

  // Bind sessionId to projectId — prevents IDOR
  const existing = await prisma.chatSession.findFirst({
    where: { id: sessionId, projectId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Session not found');
  }

  // Cascade delete handles messages
  await prisma.chatSession.delete({ where: { id: sessionId } });

  return c.json({ data: { deleted: true } });
});

export { chatSessions };
