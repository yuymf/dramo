import { Hono } from 'hono';
import { LLMConfigService } from '../services/llm-config.service';
import { validateBaseUrl, validateResolvedIPs } from '../lib/url-validator';
import { sanitizeHeaderValue } from '../lib/crypto';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';

const llmConfigs = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

// Rate limit tracking for verify endpoint (in-memory, per-process)
// NOTE: On Vercel serverless, each invocation may run in a separate process,
// so this rate limit is best-effort. For strict enforcement, use a database
// or Redis counter. Acceptable for single-process deployments.
const verifyRateMap = new Map<string, { count: number; resetAt: number }>();

function checkVerifyRateLimit(userId: string): void {
  const now = Date.now();
  const entry = verifyRateMap.get(userId);

  if (!entry || now > entry.resetAt) {
    verifyRateMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (entry.count >= 5) {
    throw new AppException(ErrorCode.RATE_LIMITED, 'Verify rate limit exceeded (5/minute)', {
      retryable: true,
    });
  }

  entry.count += 1;
}

/** GET /api/llm-configs — list all configs for current user */
llmConfigs.get('/api/llm-configs', async (c) => {
  const userId = c.get('user').userId;
  const result = await llmConfigService.listConfigs(userId);
  return c.json(result);
});

/** POST /api/llm-configs — create a new config */
llmConfigs.post('/api/llm-configs', async (c) => {
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json();

  if (!body.name?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'name is required', retryable: false }, requestId },
      400
    );
  }
  if (!body.type || !['TEXT_LLM', 'IMAGE_GEN'].includes(body.type)) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'type must be TEXT_LLM or IMAGE_GEN', retryable: false }, requestId },
      400
    );
  }
  if (!body.baseUrl?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'baseUrl is required', retryable: false }, requestId },
      400
    );
  }
  if (!body.apiKey?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'apiKey is required', retryable: false }, requestId },
      400
    );
  }
  if (!body.modelId?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'modelId is required', retryable: false }, requestId },
      400
    );
  }
  if (body.name.length > 100) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'name must be 100 characters or less', retryable: false }, requestId },
      400
    );
  }

  try {
    validateBaseUrl(body.baseUrl);
  } catch (err) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: (err as Error).message, retryable: false }, requestId },
      400
    );
  }

  try {
    const result = await llmConfigService.createConfig(userId, {
      name: body.name.trim(),
      type: body.type,
      baseUrl: body.baseUrl.trim(),
      apiKey: body.apiKey,
      modelId: body.modelId.trim(),
      isDefault: body.isDefault === true,
    });
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof AppException) throw err;
    if ((err as any)?.code === 'P2002') {
      throw new AppException(ErrorCode.LLM_CONFIG_DUPLICATE_NAME, 'A config with this name already exists');
    }
    throw err;
  }
});

/** PUT /api/llm-configs/:id — update a config */
llmConfigs.put('/api/llm-configs/:id', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');
  const body = await c.req.json();
  const requestId = c.get('requestId');

  if (body.baseUrl) {
    try {
      validateBaseUrl(body.baseUrl);
    } catch (err) {
      return c.json(
        { error: { code: 'INVALID_INPUT', message: (err as Error).message, retryable: false }, requestId },
        400
      );
    }
  }

  if (body.name !== undefined && body.name.length > 100) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'name must be 100 characters or less', retryable: false }, requestId },
      400
    );
  }

  try {
    const result = await llmConfigService.updateConfig(id, userId, {
      name: body.name?.trim(),
      baseUrl: body.baseUrl?.trim(),
      apiKey: body.apiKey,
      modelId: body.modelId?.trim(),
      isDefault: body.isDefault,
    });
    return c.json(result);
  } catch (err) {
    if (err instanceof AppException) throw err;
    if ((err as any)?.code === 'P2002') {
      throw new AppException(ErrorCode.LLM_CONFIG_DUPLICATE_NAME, 'A config with this name already exists');
    }
    throw err;
  }
});

/** DELETE /api/llm-configs/:id */
llmConfigs.delete('/api/llm-configs/:id', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');
  await llmConfigService.deleteConfig(id, userId);
  return c.json({ success: true });
});

/** POST /api/llm-configs/:id/set-default */
llmConfigs.post('/api/llm-configs/:id/set-default', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');
  await llmConfigService.setDefault(id, userId);
  return c.json({ success: true });
});

/** POST /api/llm-configs/verify — test if a key is valid */
llmConfigs.post('/api/llm-configs/verify', async (c) => {
  const userId = c.get('user').userId;

  checkVerifyRateLimit(userId);

  const body = await c.req.json();
  const requestId = c.get('requestId');

  if (!body.baseUrl || !body.apiKey || !body.modelId) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'baseUrl, apiKey, and modelId are required', retryable: false }, requestId },
      400
    );
  }

  try {
    validateBaseUrl(body.baseUrl);
  } catch (err) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: (err as Error).message, retryable: false }, requestId },
      400
    );
  }

  // DNS rebinding prevention
  try {
    await validateResolvedIPs(body.baseUrl);
  } catch (err) {
    return c.json({ valid: false, error: (err as Error).message });
  }

  try {
    const response = await fetch(`${sanitizeHeaderValue(body.baseUrl.trim())}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanitizeHeaderValue(body.apiKey)}`,
      },
      body: JSON.stringify({
        model: sanitizeHeaderValue(body.modelId.trim()),
        messages: [{ role: 'user', content: 'say hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });

    if (response.ok) {
      return c.json({ valid: true });
    }

    logger.warn({ status: response.status, userId }, 'LLM config verify failed');
    return c.json({ valid: false, error: `API returned status ${response.status}` });
  } catch (err) {
    logger.warn({ err, userId }, 'LLM config verify error');
    const message =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
        ? 'Connection timed out'
        : 'Connection failed';
    return c.json({ valid: false, error: message });
  }
});

export { llmConfigs };
