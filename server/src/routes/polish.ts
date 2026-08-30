import { Hono } from 'hono';
import { startWorkflowRun } from '../lib/agentos-client';
import { createAgentOSStream } from '../lib/sse';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';

const polish = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

function unwrapWorkflowJson(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const inner = obj.content ?? obj.output ?? obj;
    if (typeof inner === 'string') {
      try {
        return JSON.parse(inner) as Record<string, unknown>;
      } catch {
        return obj;
      }
    }
    if (typeof inner === 'object' && inner !== null) {
      return inner as Record<string, unknown>;
    }
  }
  return {};
}

polish.get('/projects/:projectId/polish/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const text = c.req.query('text');

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空' } }, 400);
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  return createAgentOSStream(c, {
    endpoint: 'polishworkflow',
    payload: { projectId, text },
    llmHeaders,
  });
});

polish.post('/projects/:projectId/polish', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const { text, operation } = await c.req.json();

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空', retryable: false }, requestId }, 400);
  }

  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    const response = await startWorkflowRun('polishworkflow', {
      projectId,
      text,
      operation,
    }, { stream: false, llmHeaders });

    const result = unwrapWorkflowJson(await response.json());
    const polished = String(result.polished_text ?? result.polished ?? '');
    const changes = Array.isArray(result.changes) ? result.changes : [];

    return c.json({
      original: String(result.original_text ?? text),
      polished,
      explanation: changes.filter((item) => typeof item === 'string').join('；'),
    });
  } catch (err) {
    logger.error({ err, projectId }, 'Polish failed');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '优化剧本失败', retryable: true }, requestId }, 502);
  }
});

export { polish };
