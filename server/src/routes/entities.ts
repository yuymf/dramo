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

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是对象');
  }
  return body as Record<string, unknown>;
}

function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, `${field} 必须是字符串`);
  }
  return value;
}

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是 JSON');
  }
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
  const body = asObject(await readJson(c));
  const description = optionalNullableString(body.description, 'description');
  const castingNotes = optionalNullableString(body.castingNotes, 'castingNotes');
  if (description === undefined && castingNotes === undefined) {
    throw new AppException(ErrorCode.MISSING_REQUIRED_FIELD, '至少提供一个可更新字段');
  }
  const result = await screenplayService.updateCharacter(projectId, characterId, userId, {
    description,
    castingNotes,
  });
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
  const body = asObject(await readJson(c));
  const description = optionalNullableString(body.description, 'description');
  const storyPlace = optionalNullableString(body.storyPlace, 'storyPlace');
  const shootPlace = optionalNullableString(body.shootPlace, 'shootPlace');
  if (description === undefined && storyPlace === undefined && shootPlace === undefined) {
    throw new AppException(ErrorCode.MISSING_REQUIRED_FIELD, '至少提供一个可更新字段');
  }
  const result = await screenplayService.updateLocation(projectId, locationId, userId, {
    description,
    storyPlace,
    shootPlace,
  });
  return c.json(result);
});

export { entities };
