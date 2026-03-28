import { Hono } from 'hono';
import { StoryboardService } from '../services/storyboard.service';
import { AssetService } from '../services/asset.service';
import { startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';
import { prisma } from '../lib/db';

const storyboard = new Hono<AuthEnv>();
const storyboardService = new StoryboardService();
const assetService = new AssetService();
const llmConfigService = new LLMConfigService();

/**
 * Import storyboard from text — calls AgentOS storyboardworkflow.
 * Supports SSE streaming via `?stream=true` query param.
 */
storyboard.post('/api/projects/:projectId/storyboard/import', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const wantStream = c.req.query('stream') === 'true';
  const userId = c.get('user').userId;

  if (!body?.text) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Missing text in request body' } }, 400);
  }

  // Authorization: verify caller owns the project (BOLA prevention)
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  if (wantStream) {
    async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
      try {
        yield { event: 'progress', data: { percent: 5, message: 'Starting storyboard import...' } };

        const [charactersLib, locationsLib] = await Promise.all([
          assetService.getCharacterLibItems(projectId),
          assetService.getLocationLibItems(projectId),
        ]);

        const response = await startWorkflowRun('storyboardworkflow', {
          projectId,
          text: body.text,
          characters_lib: charactersLib,
          locations_lib: locationsLib,
        }, { stream: true, llmHeaders });

        for await (const event of parseAgentOSSSE(response)) {
          yield event;
        }
      } catch (err) {
        logger.error({ err, projectId }, 'Storyboard import SSE failed');
        yield { event: 'error', data: { message: 'Storyboard import failed' } };
      }
    }

    return streamSSEResponse(c, generateSSE());
  }

  // Non-streaming
  try {
    const [charactersLib, locationsLib] = await Promise.all([
      assetService.getCharacterLibItems(projectId),
      assetService.getLocationLibItems(projectId),
    ]);

    const response = await startWorkflowRun('storyboardworkflow', {
      projectId,
      text: body.text,
      characters_lib: charactersLib,
      locations_lib: locationsLib,
    }, { llmHeaders });
    const result = (await response.json()) as { content?: string };

    if (result.content) {
      const storyboardData = JSON.parse(result.content);
      return c.json(storyboardData);
    }

    throw new Error('No content in workflow result');
  } catch (error) {
    logger.error({ error, projectId }, 'Storyboard import failed');
    throw error;
  }
});

storyboard.get('/api/projects/:projectId/storyboard/frames/images', async (c) => {
  const projectId = c.req.param('projectId');
  const images = await storyboardService.getFrameImages(projectId);
  return c.json({ success: true, images });
});

storyboard.put('/api/projects/:projectId/storyboard/frames/:frameId/image', async (c) => {
  const projectId = c.req.param('projectId');
  const frameId = c.req.param('frameId');
  const { image } = await c.req.json();

  await storyboardService.setFrameImage(projectId, frameId, image);
  return c.json({ success: true });
});

storyboard.delete('/api/projects/:projectId/storyboard/frames/:frameId/image', async (c) => {
  const projectId = c.req.param('projectId');
  const frameId = c.req.param('frameId');

  await storyboardService.deleteFrameImage(projectId, frameId);
  return c.json({ success: true });
});

export { storyboard };
