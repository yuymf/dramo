import { Hono } from 'hono';
import { LocationAssetService } from '../services/location-asset.service';
import { AssetService } from '../services/asset.service';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';

const assets = new Hono<AuthEnv>();
const locationAssetService = new LocationAssetService();
const assetService = new AssetService();
const llmConfigService = new LLMConfigService();

assets.post('/projects/:projectId/characters/generate-image', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  const result = await assetService.generateImageUnified(
    projectId,
    userId,
    { ...body, assetType: 'character', mode: body.mode || 'single' },
    llmHeaders
  );
  return c.json({
    id: `char_gen_${Date.now()}`,
    characterName: body.name || '未命名角色',
    description: body.description,
    images: result.images || [],
    createdAt: new Date().toISOString(),
  }, 201);
});

assets.post('/projects/:projectId/locations/generate-image', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await locationAssetService.generateLocationImage(projectId, userId, body, llmHeaders));
});

export { assets };
