import { Hono } from 'hono';
import { AppException, ErrorCode } from '../lib/errors.js';
import type { AuthEnv } from '../middleware/session.js';
import { CinemaService } from '../services/cinema.service.js';
import { CINEMA_ASSIST_TARGETS, type CinemaAssistTarget, type ReelShot } from '../types/cinema.js';
import { asObject, readJson, requireUser } from './helpers.js';

const cinema = new Hono<AuthEnv>();
const service = new CinemaService();

function parseShots(value: unknown): ReelShot[] {
  if (!Array.isArray(value)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'shots 必须是数组');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppException(ErrorCode.INVALID_INPUT, `shots[${index}] 必须是对象`);
    }
    const raw = item as Record<string, unknown>;
    return {
      id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
      description: typeof raw.description === 'string' ? raw.description : '',
      camera: typeof raw.camera === 'string' ? raw.camera : '',
    };
  });
}

const EPISODE = '/projects/:projectId/episodes/:episodeId';
const REEL = '/projects/:projectId/reels/:reelId';

cinema.get(`${EPISODE}/reels`, async (c) => {
  return c.json(
    await service.listReels(c.req.param('projectId'), c.req.param('episodeId'), requireUser(c).userId)
  );
});

cinema.post(`${EPISODE}/reels`, async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.createReel(c.req.param('projectId'), c.req.param('episodeId'), requireUser(c).userId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      previousReelId: typeof body.previousReelId === 'string' ? body.previousReelId : undefined,
    }),
    201
  );
});

cinema.get(REEL, async (c) => {
  return c.json(await service.getReel(c.req.param('projectId'), c.req.param('reelId'), requireUser(c).userId));
});

cinema.patch(REEL, async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.patchReel(c.req.param('projectId'), c.req.param('reelId'), requireUser(c).userId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      sceneText: typeof body.sceneText === 'string' ? body.sceneText : undefined,
      performance: typeof body.performance === 'string' ? body.performance : undefined,
      shots: body.shots !== undefined ? parseShots(body.shots) : undefined,
      previousReelId:
        body.previousReelId === null ? null : typeof body.previousReelId === 'string' ? body.previousReelId : undefined,
    })
  );
});

cinema.post(`${REEL}/storyboard`, async (c) => {
  return c.json(
    await service.generateStoryboard(c.req.param('projectId'), c.req.param('reelId'), requireUser(c).userId)
  );
});

cinema.post(`${REEL}/images`, async (c) => {
  return c.json(await service.generateImages(c.req.param('projectId'), c.req.param('reelId'), requireUser(c).userId));
});

cinema.post(`${REEL}/films`, async (c) => {
  return c.json(await service.generateFilm(c.req.param('projectId'), c.req.param('reelId'), requireUser(c).userId));
});

cinema.post(`${REEL}/assist`, async (c) => {
  const body = asObject(await readJson(c));
  const target = body.target;
  if (typeof target !== 'string' || !(CINEMA_ASSIST_TARGETS as readonly string[]).includes(target)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'target 必须是 scene、performance 或 shots');
  }
  return c.json(
    await service.assist(c.req.param('projectId'), c.req.param('reelId'), requireUser(c).userId, {
      target: target as CinemaAssistTarget,
      instruction: typeof body.instruction === 'string' ? body.instruction : '',
    })
  );
});

export { cinema };
