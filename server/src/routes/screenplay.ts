import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/session.js';
import { ScreenplayService } from '../services/screenplay.service.js';
import { readJson, requireUser } from './helpers.js';

const screenplay = new Hono<AuthEnv>();
const screenplayService = new ScreenplayService();

const EPISODE_PATH = '/projects/:projectId/episodes/:episodeId/screenplay';

screenplay.get(`${EPISODE_PATH}/versions`, async (c) => {
  const projectId = c.req.param('projectId');
  const episodeId = c.req.param('episodeId');
  const userId = requireUser(c).userId;
  const result = await screenplayService.listVersions(projectId, episodeId, userId);
  return c.json(result);
});

screenplay.post(`${EPISODE_PATH}/versions/:vid/revert`, async (c) => {
  const projectId = c.req.param('projectId');
  const episodeId = c.req.param('episodeId');
  const vid = c.req.param('vid');
  const userId = requireUser(c).userId;
  const result = await screenplayService.revertVersion(projectId, episodeId, vid, userId);
  return c.json(result);
});

screenplay.post(`${EPISODE_PATH}/revise`, async (c) => {
  const projectId = c.req.param('projectId');
  const episodeId = c.req.param('episodeId');
  const userId = requireUser(c).userId;
  const requestId = c.get('requestId');
  const body = await readJson(c);
  const result = await screenplayService.reviseScreenplay(
    projectId,
    episodeId,
    userId,
    body as { instruction?: unknown; scope?: unknown },
    requestId
  );
  return c.json(result);
});

screenplay.get(EPISODE_PATH, async (c) => {
  const projectId = c.req.param('projectId');
  const episodeId = c.req.param('episodeId');
  const userId = requireUser(c).userId;
  const result = await screenplayService.getScreenplay(projectId, episodeId, userId);
  return c.json(result);
});

screenplay.put(EPISODE_PATH, async (c) => {
  const projectId = c.req.param('projectId');
  const episodeId = c.req.param('episodeId');
  const userId = requireUser(c).userId;
  const body = await readJson(c);
  const result = await screenplayService.putScreenplay(
    projectId,
    episodeId,
    userId,
    body as { title?: unknown; cover?: unknown; nodes?: unknown }
  );
  return c.json(result);
});

export { screenplay };
