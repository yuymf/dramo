import { Hono } from 'hono';
import { StorageService } from '../services/storage.service';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/default-user';

const uploads = new Hono<AuthEnv>();
const storageService = new StorageService();

uploads.post('/projects/:projectId/uploads/image', async (c) => {
  const projectId = c.req.param('projectId');
  const { base64Data } = await c.req.json();

  if (!base64Data) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'base64Data is required' } }, 400);
  }

  const result = await storageService.uploadImageFromBase64(projectId, base64Data);
  logger.info({ projectId, url: result.url }, 'Image uploaded');
  return c.json({ success: true, url: result.url, path: result.path });
});

export { uploads };
