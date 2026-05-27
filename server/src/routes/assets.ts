import { Hono } from 'hono';
import { CharacterAssetService } from '../services/character-asset.service';
import { LocationAssetService } from '../services/location-asset.service';
import { AssetService } from '../services/asset.service';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';

const assets = new Hono<AuthEnv>();
const characterAssetService = new CharacterAssetService();
const locationAssetService = new LocationAssetService();
const assetService = new AssetService(); // Keep for generateImageUnified
const llmConfigService = new LLMConfigService();

assets.post('/projects/:projectId/characters/generate-3view', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await characterAssetService.generateCharacter3View(projectId, userId, body, llmHeaders));
});

assets.post('/projects/:projectId/locations/generate-image', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await locationAssetService.generateLocationImage(projectId, userId, body, llmHeaders));
});

assets.post('/projects/:projectId/generate-image', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await assetService.generateImageUnified(projectId, userId, body, llmHeaders));
});

export { assets };
