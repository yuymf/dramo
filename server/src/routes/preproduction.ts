import { Hono } from 'hono';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';
import { PreproductionService, type ShotInput } from '../services/preproduction.service';

const preproduction = new Hono<AuthEnv>();
const service = new PreproductionService();

function requireUser(c: { get: (key: 'user') => AuthEnv['Variables']['user'] | undefined }) {
  const user = c.get('user');
  if (!user) throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
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

function parseShots(value: unknown): ShotInput[] {
  if (!Array.isArray(value)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'shots 必须是数组');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppException(ErrorCode.INVALID_INPUT, `shots[${index}] 必须是对象`);
    }
    const raw = item as Record<string, unknown>;
    return {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      sceneHeading: typeof raw.sceneHeading === 'string' ? raw.sceneHeading : '',
      description: typeof raw.description === 'string' ? raw.description : '',
      camera: typeof raw.camera === 'string' ? raw.camera : '',
      design: typeof raw.design === 'string' ? raw.design : '',
    };
  });
}

const EPISODE = '/projects/:projectId/episodes/:episodeId';

preproduction.get(`${EPISODE}/scenes`, async (c) => {
  return c.json(
    await service.listScenes(c.req.param('projectId'), c.req.param('episodeId'), requireUser(c).userId)
  );
});

preproduction.get(`${EPISODE}/shots`, async (c) => {
  return c.json(
    await service.listShots(c.req.param('projectId'), c.req.param('episodeId'), requireUser(c).userId)
  );
});

preproduction.put(`${EPISODE}/shots`, async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.putShots(
      c.req.param('projectId'),
      c.req.param('episodeId'),
      requireUser(c).userId,
      parseShots(body.shots)
    )
  );
});

preproduction.get(`${EPISODE}/export/fdx`, async (c) => {
  const result = await service.exportFdx(
    c.req.param('projectId'),
    c.req.param('episodeId'),
    requireUser(c).userId
  );
  return c.json(result);
});

preproduction.post('/projects/import-fdx', async (c) => {
  const body = asObject(await readJson(c));
  if (typeof body.xml !== 'string' || !body.xml.trim()) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'xml 不能为空');
  }
  const result = await service.importFdx(
    requireUser(c).userId,
    body.xml,
    typeof body.name === 'string' ? body.name : undefined
  );
  return c.json(result, 201);
});

preproduction.get('/projects/:projectId/assets', async (c) => {
  return c.json(await service.listAssets(c.req.param('projectId'), requireUser(c).userId));
});

export { preproduction };
