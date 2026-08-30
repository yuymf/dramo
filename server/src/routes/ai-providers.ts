import { Hono } from 'hono';
import { getAgentOS, postAgentOS } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/default-user';

const aiProviders = new Hono<AuthEnv>();

aiProviders.get('/ai/providers', async (c) => {
  const requestId = c.get('requestId');
  try {
    const data = await getAgentOS<unknown>('/api/ai/providers');
    return c.json({ success: true, data, requestId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list AI providers';
    logger.error({ error, requestId }, 'Failed to list AI providers');
    return c.json({ error: { code: 'AGENTOS_ERROR', message, retryable: true }, requestId }, 500);
  }
});

aiProviders.get('/ai/provider', async (c) => {
  const requestId = c.get('requestId');
  try {
    const data = await getAgentOS<unknown>('/api/ai/provider');
    return c.json({ success: true, data, requestId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get current provider';
    logger.error({ error, requestId }, 'Failed to get current provider');
    return c.json({ error: { code: 'AGENTOS_ERROR', message, retryable: true }, requestId }, 500);
  }
});

aiProviders.post('/ai/provider', async (c) => {
  const requestId = c.get('requestId');
  const { provider } = await c.req.json();

  try {
    const data = await postAgentOS<unknown>('/api/ai/provider', { provider });
    return c.json({ success: true, data, message: `AI provider switched to ${provider}`, requestId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to switch AI provider';
    logger.error({ error, requestId }, 'Failed to switch AI provider');
    return c.json({ error: { code: 'AGENTOS_ERROR', message, retryable: true }, requestId }, 500);
  }
});

export { aiProviders };
