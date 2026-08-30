import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/session';
import { config } from '../config';
import { checkAgentOSHealth } from '../lib/agentos-client';

const health = new Hono<AuthEnv>();

health.get('/health', async (c) => {
  return c.json({
    ok: true,
    version: config.version,
    timestamp: new Date().toISOString(),
  });
});

health.get('/health/deep', async (c) => {
  const agentosOk = await checkAgentOSHealth();

  return c.json({
    ok: agentosOk,
    version: config.version,
    agentos: agentosOk ? 'healthy' : 'unreachable',
    timestamp: new Date().toISOString(),
  });
});

export { health };
