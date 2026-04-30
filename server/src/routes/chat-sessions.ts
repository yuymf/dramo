import { Hono } from 'hono';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/auth';

const chatSessions = new Hono<AuthEnv>();

const DEFAULT_SESSION_TITLE = '新对话';
const LEGACY_SESSION_TITLE = '历史对话';

/**
 * POST /api/chat/:projectId/sessions/migrate-legacy
 * Migrate orphaned messages (no sessionId) into a "历史对话" session.
 * Registered BEFORE the :sessionId routes to avoid path shadowing.
 */
chatSessions.post('/chat/:projectId/sessions/migrate-legacy', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  // Atomic transaction to prevent race conditions with concurrent calls
  const result = await prisma.$transaction(async (tx) => {
    const orphanCount = await tx.chatMessage.count({
      where: { projectId, sessionId: null },
    });

    if (orphanCount === 0) {
      return { session: null, migrated: 0 };
    }

    const session = await tx.chatSession.create({
      data: { projectId, title: LEGACY_SESSION_TITLE },
    });

    const updated = await tx.chatMessage.updateMany({
      where: { projectId, sessionId: null },
      data: { sessionId: session.id },
    });

    return { session, migrated: updated.count };
  });

  return c.json({ data: result.session, migrated: result.migrated, requestId });
});

/**
 * GET /api/chat/:projectId/sessions — List all sessions for a project
 */
chatSessions.get('/chat/:projectId/sessions', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

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
  const userId = c.get('user').userId;
  const body = await c.req.json<{ title?: string }>().catch(() => ({} as { title?: string }));

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

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
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json<{ title?: string }>().catch(() => ({} as { title?: string }));

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

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
  const userId = c.get('user').userId;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

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
