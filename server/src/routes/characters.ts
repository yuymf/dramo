import { Hono } from 'hono';
import { startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';

const characters = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

/**
 * SSE streaming endpoint for character extraction.
 * Replaces Redis-cached version — cache removed for serverless simplicity.
 */
characters.get('/api/projects/:projectId/characters/extract/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const text = c.req.query('text');

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空' } }, 400);
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      yield { event: 'progress', data: { percent: 5, message: 'Starting character extraction...' } };

      const response = await startWorkflowRun('charactersworkflow', {
        projectId,
        text,
      }, { stream: true, llmHeaders });

      for await (const event of parseAgentOSSSE(response)) {
        yield event;
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Characters extraction SSE failed');
      yield { event: 'error', data: { message: '提取角色信息失败' } };
    }
  }

  return streamSSEResponse(c, generateSSE());
});

/**
 * Non-streaming character extraction.
 */
characters.post('/api/projects/:projectId/characters/extract', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const { text } = await c.req.json();

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空', retryable: false }, requestId }, 400);
  }

  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    const response = await startWorkflowRun('charactersworkflow', {
      projectId,
      text,
    }, { stream: false, llmHeaders });

    const result = await response.json();
    return c.json(result);
  } catch (err) {
    logger.error({ err, projectId }, 'Characters extraction failed');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '提取角色信息失败', retryable: true }, requestId }, 502);
  }
});

export { characters };
