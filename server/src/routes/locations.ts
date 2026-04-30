import { Hono } from 'hono';
import { startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';
import { prisma } from '../lib/db';

const locations = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

locations.get('/projects/:projectId/locations/extract/stream', async (c) => {
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

locations.post('/projects/:projectId/locations/extract', async (c) => {
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

    const result = await response.json() as Record<string, unknown>;

    // AgentOS wraps the result: { content: "{...json...}", workflow_id, ... }
    // Parse the inner content to get the actual location data
    let locationData: Record<string, unknown> = result;
    if (typeof result?.content === 'string') {
      try {
        locationData = JSON.parse(result.content);
      } catch {
        logger.warn({ projectId }, 'Failed to parse locations content string');
      }
    }

    // Persist extracted locations to LocationAsset table
    // Clear existing assets first (extraction is a replace operation)
    await prisma.locationAsset.deleteMany({ where: { projectId } });

    // Handle nested structure: locations may be [ { locations: [...actual...] } ]
    let rawLocs = Array.isArray((locationData as Record<string, unknown>)?.locations) ? (locationData as { locations: Record<string, unknown>[] }).locations : [];
    if (rawLocs.length > 0 && !rawLocs[0].name && Array.isArray(rawLocs[0].locations)) {
      // Unwrap nested: [ { locations: [...] } ] → [...]
      rawLocs = rawLocs.flatMap((item: Record<string, unknown>) =>
        Array.isArray(item.locations) ? item.locations as Record<string, unknown>[] : [item]
      );
      // Also fix the response data for the frontend
      locationData = { ...locationData, locations: rawLocs };
    }

    const savedIds: string[] = [];
    for (const loc of rawLocs) {
      try {
        const asset = await prisma.locationAsset.create({
          data: {
            projectId,
            name: (loc.name as string) || '未命名场景',
            description: (loc.description as string | undefined) || (loc.atmosphere as string | undefined) || undefined,
            alias: (loc.alias as string | undefined) || undefined,
            images: [],
          },
        });
        savedIds.push(asset.id);
      } catch (saveErr) {
        logger.warn({ saveErr, projectId, locName: loc.name }, 'Failed to save extracted location');
      }
    }

    logger.info({ projectId, extracted: rawLocs.length, saved: savedIds.length }, 'Locations extracted and persisted');

    return c.json(locationData);
  } catch (err) {
    logger.error({ err, projectId }, 'Locations extraction failed');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '提取地点信息失败', retryable: true }, requestId }, 502);
  }
});

export { locations };
