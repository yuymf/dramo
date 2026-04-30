import { Hono } from 'hono';
import { AssetService } from '../services/asset.service';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';

const assets = new Hono<AuthEnv>();
const assetService = new AssetService();
const llmConfigService = new LLMConfigService();

assets.post('/projects/:projectId/characters/generate-3view', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await assetService.generateCharacter3View(projectId, userId, body, llmHeaders));
});

assets.get('/projects/:projectId/characters/assets', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  return c.json(await assetService.listCharacterAssets(projectId, userId));
});

assets.post('/projects/:projectId/characters/assets', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  return c.json(await assetService.createCharacterAsset(projectId, body));
});

assets.put('/projects/:projectId/characters/assets/:assetId', async (c) => {
  const projectId = c.req.param('projectId');
  const assetId = c.req.param('assetId');
  const body = await c.req.json();
  return c.json(await assetService.updateCharacterAsset(projectId, assetId, body));
});

assets.delete('/projects/:projectId/characters/assets/:assetId', async (c) => {
  const projectId = c.req.param('projectId');
  const assetId = c.req.param('assetId');
  return c.json(await assetService.deleteCharacterAsset(projectId, assetId));
});

assets.post('/projects/:projectId/locations/generate-image', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await assetService.generateLocationImage(projectId, userId, body, llmHeaders));
});

assets.get('/projects/:projectId/locations/assets', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  return c.json(await assetService.listLocationAssets(projectId, userId));
});

assets.post('/projects/:projectId/locations/assets', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  return c.json(await assetService.createLocationAsset(projectId, body));
});

assets.put('/projects/:projectId/locations/assets/:assetId', async (c) => {
  const projectId = c.req.param('projectId');
  const assetId = c.req.param('assetId');
  const body = await c.req.json();
  return c.json(await assetService.updateLocationAsset(projectId, assetId, body));
});

assets.delete('/projects/:projectId/locations/assets/:assetId', async (c) => {
  const projectId = c.req.param('projectId');
  const assetId = c.req.param('assetId');
  return c.json(await assetService.deleteLocationAsset(projectId, assetId));
});

assets.post('/projects/:projectId/generate-image', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_GEN');
  return c.json(await assetService.generateImageUnified(projectId, userId, body, llmHeaders));
});

export { assets };
