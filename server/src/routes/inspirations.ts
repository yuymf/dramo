import { Hono } from 'hono';
import { InspirationService } from '../services/inspiration.service';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';

const inspirations = new Hono<AuthEnv>();
const inspirationService = new InspirationService();
const llmConfigService = new LLMConfigService();

inspirations.get('/inspirations/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const category = c.req.query('category');
  const userId = c.get('user').userId;

  return c.json(await inspirationService.getInspirations(projectId, userId, category));
});

inspirations.post('/inspirations/:projectId/recommend', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  return c.json(await inspirationService.recommendInspirations(projectId, userId, {
    script: body.script,
    position: body.position,
    category: body.category,
  }, llmHeaders));
});

inspirations.post('/inspirations/favorite', async (c) => {
  const { inspirationId } = await c.req.json();
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  if (!inspirationId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'inspirationId is required', retryable: false }, requestId }, 400);
  }

  return c.json(await inspirationService.toggleFavorite(inspirationId, userId));
});

inspirations.get('/inspirations/favorites', async (c) => {
  const userId = c.get('user').userId;
  return c.json(await inspirationService.getFavorites(userId));
});

export { inspirations };
