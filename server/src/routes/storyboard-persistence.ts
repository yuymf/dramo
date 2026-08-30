import { Hono } from 'hono';
import { StoryboardDataService } from '../services/storyboard-data.service';
import { StoryboardService } from '../services/storyboard.service';
import type { AuthEnv } from '../middleware/default-user';

const storyboardPersistence = new Hono<AuthEnv>();
const storyboardDataService = new StoryboardDataService();
const storyboardService = new StoryboardService();

storyboardPersistence.get('/projects/:projectId/storyboard-data', async (c) => {
  const projectId = c.req.param('projectId');
  const [frames, images] = await Promise.all([
    storyboardDataService.getStoryboard(projectId),
    storyboardService.getFrameImages(projectId),
  ]);
  return c.json({ success: true, frames, images });
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

export { storyboardPersistence };
