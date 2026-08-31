import { Hono } from 'hono';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';
import { PlanningService, type BeatInput, type WorldviewRuleRecord } from '../services/planning.service';

const planning = new Hono<AuthEnv>();
const planningService = new PlanningService();

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

function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, `${field} 必须是字符串`);
  }
  return value;
}

function parseBeats(value: unknown): BeatInput[] {
  if (!Array.isArray(value)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'beats 必须是数组');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppException(ErrorCode.INVALID_INPUT, `beats[${index}] 必须是对象`);
    }
    const raw = item as Record<string, unknown>;
    if (raw.id !== undefined && (typeof raw.id !== 'string' || !raw.id.trim())) {
      throw new AppException(ErrorCode.INVALID_INPUT, `beats[${index}].id 必须是非空字符串`);
    }
    for (const field of ['action', 'intent', 'outcome'] as const) {
      if (raw[field] !== undefined && typeof raw[field] !== 'string') {
        throw new AppException(ErrorCode.INVALID_INPUT, `beats[${index}].${field} 必须是字符串`);
      }
    }
    return {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      action: typeof raw.action === 'string' ? raw.action : '',
      intent: typeof raw.intent === 'string' ? raw.intent : '',
      outcome: typeof raw.outcome === 'string' ? raw.outcome : '',
    };
  });
}

function parseRules(value: unknown): WorldviewRuleRecord[] {
  if (!Array.isArray(value)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'rules 必须是数组');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppException(ErrorCode.INVALID_INPUT, `rules[${index}] 必须是对象`);
    }
    const raw = item as Record<string, unknown>;
    if (typeof raw.key !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, `rules[${index}].key 必须是字符串`);
    }
    if (raw.value !== undefined && typeof raw.value !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, `rules[${index}].value 必须是字符串`);
    }
    return { key: raw.key, value: typeof raw.value === 'string' ? raw.value : '' };
  });
}

const EPISODE = '/projects/:projectId/episodes/:episodeId';

planning.get(`${EPISODE}/outline`, async (c) => {
  const userId = requireUser(c).userId;
  const result = await planningService.getOutline(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    userId
  );
  return c.json(result);
});

planning.put(`${EPISODE}/outline`, async (c) => {
  const userId = requireUser(c).userId;
  const body = asObject(await readJson(c));
  if (typeof body.markdown !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, 'markdown 必须是字符串');
  }
  const result = await planningService.putOutline(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    userId,
    body.markdown
  );
  return c.json(result);
});

planning.get(`${EPISODE}/beats`, async (c) => {
  const userId = requireUser(c).userId;
  const result = await planningService.getBeats(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    userId
  );
  return c.json(result);
});

planning.put(`${EPISODE}/beats`, async (c) => {
  const userId = requireUser(c).userId;
  const body = asObject(await readJson(c));
  const result = await planningService.putBeats(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    userId,
    parseBeats(body.beats)
  );
  return c.json(result);
});

planning.get(`${EPISODE}/beats/coverage`, async (c) => {
  const userId = requireUser(c).userId;
  const result = await planningService.getCoverage(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    userId
  );
  return c.json(result);
});

planning.get('/projects/:projectId/props', async (c) => {
  const userId = requireUser(c).userId;
  const result = await planningService.listProps(c.req.param('projectId'), userId);
  return c.json(result);
});

planning.patch('/projects/:projectId/props/:propId', async (c) => {
  const userId = requireUser(c).userId;
  const body = asObject(await readJson(c));
  const description = optionalNullableString(body.description, 'description');
  const holder = optionalNullableString(body.holder, 'holder');
  const continuity = optionalNullableString(body.continuity, 'continuity');
  if (description === undefined && holder === undefined && continuity === undefined) {
    throw new AppException(ErrorCode.MISSING_REQUIRED_FIELD, '至少提供一个可更新字段');
  }
  const result = await planningService.updateProp(
    c.req.param('projectId'),
    c.req.param('propId'),
    userId,
    { description, holder, continuity }
  );
  return c.json(result);
});

planning.get('/projects/:projectId/worldview', async (c) => {
  const userId = requireUser(c).userId;
  const result = await planningService.getWorldview(c.req.param('projectId'), userId);
  return c.json(result);
});

planning.put('/projects/:projectId/worldview', async (c) => {
  const userId = requireUser(c).userId;
  const body = asObject(await readJson(c));
  const result = await planningService.putWorldview(
    c.req.param('projectId'),
    userId,
    parseRules(body.rules)
  );
  return c.json(result);
});

export { planning };
