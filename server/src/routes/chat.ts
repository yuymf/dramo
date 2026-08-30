import { Hono } from 'hono';
import { prisma } from '../lib/db';
import { streamSSEResponse } from '../lib/sse';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/default-user';
import { ChatService } from '../services/chat.service';

const chat = new Hono<AuthEnv>();
const chatService = new ChatService();

const MAX_CONTENT_LENGTH = 10_000;
const ALLOWED_MESSAGE_TYPES = new Set(['text', 'options', 'progress', null, undefined]);

chat.get('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const sessionId = c.req.query('sessionId');
  if (!sessionId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'sessionId is required', retryable: false }, requestId: c.get('requestId') }, 400);
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  if (!(await chatService.validateSessionId(sessionId, projectId))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found', retryable: false }, requestId: c.get('requestId') }, 404);
  }

  const messages = await chatService.listMessages(projectId, sessionId);
  return c.json({ data: messages, projectId });
});

chat.post('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  const content = typeof body.content === 'string' ? body.content : '';
  if (!content.trim())
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Message content is required', retryable: false }, requestId }, 400);
  if (content.length > MAX_CONTENT_LENGTH)
    return c.json({ error: { code: 'INVALID_INPUT', message: `Message too long (max ${MAX_CONTENT_LENGTH} chars)`, retryable: false }, requestId }, 400);
  if (!ALLOWED_MESSAGE_TYPES.has(body.messageType as string | null | undefined))
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid messageType', retryable: false }, requestId }, 400);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId)
    return c.json({ error: { code: 'INVALID_INPUT', message: 'sessionId is required', retryable: false }, requestId }, 400);
  if (!(await chatService.validateSessionId(sessionId, projectId)))
    return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found', retryable: false }, requestId }, 404);

  await chatService.createUserMessage({
    projectId, sessionId, content,
    messageType: (body.messageType as string) || null,
    selectedOption: (body.selectedOption as object) || undefined,
  });

  const messages = await chatService.getHistory(projectId, sessionId);
  const sseGen = chatService.generateSSE({ userId, projectId, sessionId, userContent: content, messages, requestId });
  return streamSSEResponse(c, sseGen);
});

chat.post('/chat/:projectId/reset', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'sessionId is required', retryable: false }, requestId: c.get('requestId') }, 400);
  }
  if (!(await chatService.validateSessionId(sessionId, projectId))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found', retryable: false }, requestId: c.get('requestId') }, 404);
  }

  await chatService.deleteMessages(projectId, sessionId);
  return c.json({ projectId, reset: true, message: '对话已重置' });
});

export { chat };
