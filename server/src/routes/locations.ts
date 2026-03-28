import { Hono } from 'hono';
import { startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';

const locations = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

locations.get('/api/projects/:projectId/locations/extract/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const text = c.req.query('text');

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空' } }, 400);
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      yield { event: 'progress', data: { percent: 5, message: 'Starting location extraction...' } };

      const response = await startWorkflowRun('locationsworkflow', {
        projectId,
        text,
      }, { stream: true, llmHeaders });

      for await (const event of parseAgentOSSSE(response)) {
        yield event;
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Locations extraction SSE failed');
      yield { event: 'error', data: { message: '提取地点信息失败' } };
    }
  }

  return streamSSEResponse(c, generateSSE());
});

locations.post('/api/projects/:projectId/locations/extract', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const { text } = await c.req.json();

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空', retryable: false }, requestId }, 400);
  }

  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    const response = await startWorkflowRun('locationsworkflow', {
      projectId,
      text,
    }, { stream: false, llmHeaders });

    const result = await response.json();
    return c.json(result);
  } catch (err) {
    logger.error({ err, projectId }, 'Locations extraction failed');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '提取地点信息失败', retryable: true }, requestId }, 502);
  }
});

export { locations };
