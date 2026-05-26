import { Hono } from 'hono';
import { StoryboardDataService } from '../services/storyboard-data.service';
import type { AuthEnv } from '../middleware/default-user';

const storyboardPersistence = new Hono<AuthEnv>();
const storyboardDataService = new StoryboardDataService();

storyboardPersistence.get('/projects/:projectId/storyboard-data', async (c) => {
  const projectId = c.req.param('projectId');
  const frames = await storyboardDataService.getStoryboard(projectId);
  return c.json({ success: true, frames });
});

storyboardPersistence.put('/projects/:projectId/storyboard-data', async (c) => {
  const projectId = c.req.param('projectId');
  const { frames } = await c.req.json();

  if (!Array.isArray(frames)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'frames must be an array' } }, 400);
  }

  await storyboardDataService.saveStoryboard(projectId, frames);
  return c.json({ success: true, updatedAt: new Date().toISOString() });
});

storyboardPersistence.patch('/projects/:projectId/storyboard-data/frames/:frameId', async (c) => {
  const projectId = c.req.param('projectId');
  const frameId = c.req.param('frameId');
  const updates = await c.req.json();

  await storyboardDataService.updateFrame(projectId, frameId, updates);
  return c.json({ success: true });
});

storyboardPersistence.delete('/projects/:projectId/storyboard-data', async (c) => {
  const projectId = c.req.param('projectId');
  await storyboardDataService.deleteStoryboard(projectId);
  return c.json({ success: true });
});

export { storyboardPersistence };
