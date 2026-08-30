import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/default-user';
import { config } from '../config';

const health = new Hono<AuthEnv>();

health.get('/health', async (c) => {
  return c.json({
    ok: true,
    version: config.version,
    timestamp: new Date().toISOString(),
  });
});

export { health };
