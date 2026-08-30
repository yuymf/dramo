import { Hono } from 'hono';
import { prisma } from '../lib/db';
import { streamSSEResponse } from '../lib/sse';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';
import { ChatService } from '../services/chat.service';

const chat = new Hono<AuthEnv>();
const chatService = new ChatService();

const MAX_CONTENT_LENGTH = 10_000;
const ALLOWED_MESSAGE_TYPES = new Set(['text', 'options', 'progress', null, undefined]);

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

chat.get('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;
  const sessionId = c.req.query('sessionId');

  await requireProjectMember(projectId, userId);

  const messages = await chatService.listMessages(projectId, sessionId);
  return c.json({ data: messages, projectId });
});

chat.post('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;
  const requestId = c.get('requestId');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  const content = typeof body.content === 'string' ? body.content : '';
  if (!content.trim())
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Message content is required', retryable: false }, requestId }, 400);
  if (content.length > MAX_CONTENT_LENGTH)
    return c.json({ error: { code: 'INVALID_INPUT', message: `Message too long (max ${MAX_CONTENT_LENGTH} chars)`, retryable: false }, requestId }, 400);
  if (!ALLOWED_MESSAGE_TYPES.has(body.messageType as string | null | undefined))
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid messageType', retryable: false }, requestId }, 400);

  await requireProjectMember(projectId, userId);

  const sessionId = await chatService.ensureSession(
    projectId,
    typeof body.sessionId === 'string' ? body.sessionId : undefined
  );

  const userMessage = await chatService.createUserMessage({
    sessionId,
    content,
    messageType: (body.messageType as string) || null,
  });

  const messages = await chatService.getHistory(sessionId);

  if (body.stream) {
    const sseGen = chatService.generateSSE({ userId, projectId, sessionId, messages, requestId });
    return streamSSEResponse(c, sseGen);
  }

  const result = await chatService.generateNonStreaming({ userId, sessionId, userMessageRecord: userMessage, messages, requestId });
  return c.json(result);
});

chat.post('/chat/:projectId/reset', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  await requireProjectMember(projectId, userId);

  await chatService.deleteMessages(projectId, typeof body.sessionId === 'string' ? body.sessionId : undefined);
  return c.json({ projectId, reset: true, message: '对话已重置' });
});

export { chat };
