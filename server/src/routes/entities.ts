import { Hono } from 'hono';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';
import { ScreenplayService } from '../services/screenplay.service';

const entities = new Hono<AuthEnv>();
const screenplayService = new ScreenplayService();

function requireUser(c: { get: (key: 'user') => AuthEnv['Variables']['user'] | undefined }) {
  const user = c.get('user');
  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }
  return user;
}

entities.get('/projects/:projectId/characters', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;
  const result = await screenplayService.listCharacters(projectId, userId);
  return c.json(result);
});

entities.patch('/projects/:projectId/characters/:characterId', async (c) => {
  const projectId = c.req.param('projectId');
  const characterId = c.req.param('characterId');
  const userId = requireUser(c).userId;
  const description = await readDescription(c);
  const result = await screenplayService.updateCharacter(
    projectId,
    characterId,
    userId,
    description
  );
  return c.json(result);
});

entities.get('/projects/:projectId/locations', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = requireUser(c).userId;
  const result = await screenplayService.listLocations(projectId, userId);
  return c.json(result);
});

entities.patch('/projects/:projectId/locations/:locationId', async (c) => {
  const projectId = c.req.param('projectId');
  const locationId = c.req.param('locationId');
  const userId = requireUser(c).userId;
  const description = await readDescription(c);
  const result = await screenplayService.updateLocation(
    projectId,
    locationId,
    userId,
    description
  );
  return c.json(result);
});

async function readDescription(c: { req: { json: () => Promise<unknown> } }): Promise<string | null> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是 JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('description' in body)) {
    throw new AppException(ErrorCode.MISSING_REQUIRED_FIELD, 'description 不能为空');
  }
  const description = (body as { description: unknown }).description;
  if (description === null) return null;
  if (typeof description !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, 'description 必须是字符串');
  }
  return description;
}

export { entities };
