import { Hono } from 'hono';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';
import { ADVISORS, AssistService } from '../services/assist.service';

const assist = new Hono<AuthEnv>();
const assistService = new AssistService();

function requireUser(c: { get: (key: 'user') => AuthEnv['Variables']['user'] | undefined }) {
  const user = c.get('user');
  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }
  return user;
}

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是 JSON');
  }
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是对象');
  }
  return body as Record<string, unknown>;
}

assist.get('/advisors', (c) => c.json({ advisors: ADVISORS }));

assist.get('/projects/:projectId/knowledge', async (c) => {
  const result = await assistService.listKnowledge(c.req.param('projectId'), requireUser(c).userId);
  return c.json(result);
});

assist.post('/projects/:projectId/knowledge', async (c) => {
  const body = asObject(await readJson(c));
  if (typeof body.name !== 'string' || typeof body.filename !== 'string' || typeof body.text !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, 'name / filename / text 必须是字符串');
  }
  const result = await assistService.createKnowledge(c.req.param('projectId'), requireUser(c).userId, {
    name: body.name,
    filename: body.filename,
    text: body.text,
    mime: typeof body.mime === 'string' ? body.mime : undefined,
  });
  return c.json(result, 201);
});

assist.delete('/projects/:projectId/knowledge/:fileId', async (c) => {
  const result = await assistService.deleteKnowledge(
    c.req.param('projectId'),
    c.req.param('fileId'),
    requireUser(c).userId
  );
  return c.json(result);
});

assist.get('/projects/:projectId/advisor', async (c) => {
  const result = await assistService.getAdvisor(c.req.param('projectId'), requireUser(c).userId);
  return c.json(result);
});

assist.put('/projects/:projectId/advisor', async (c) => {
  const body = asObject(await readJson(c));
  if (body.id !== null && typeof body.id !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, 'id 必须是字符串或 null');
  }
  const result = await assistService.putAdvisor(
    c.req.param('projectId'),
    requireUser(c).userId,
    body.id
  );
  return c.json(result);
});

const EPISODE = '/projects/:projectId/episodes/:episodeId';

assist.get(`${EPISODE}/cold-start`, async (c) => {
  const result = await assistService.getColdStart(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    requireUser(c).userId
  );
  return c.json(result);
});

assist.put(`${EPISODE}/cold-start`, async (c) => {
  const result = await assistService.putColdStart(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    requireUser(c).userId,
    await readJson(c)
  );
  return c.json(result);
});

assist.get(`${EPISODE}/doctor`, async (c) => {
  const result = await assistService.getDoctor(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    requireUser(c).userId
  );
  return c.json(result);
});

assist.post(`${EPISODE}/micro-continue`, async (c) => {
  const body = asObject(await readJson(c));
  if (typeof body.afterNodeId !== 'string' || !body.afterNodeId.trim()) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'afterNodeId 必须是非空字符串');
  }
  const result = await assistService.microContinue(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    requireUser(c).userId,
    body.afterNodeId
  );
  return c.json(result);
});

export { assist };
