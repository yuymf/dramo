import { Hono } from 'hono';
import { StoryboardService } from '../services/storyboard.service';
import { AssetService } from '../services/asset.service';
import { TaskService } from '../services/task.service';
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
const taskService = new TaskService();

/**
 * Execute storyboard import in background (fire-and-forget).
 * Updates Task record with progress/result/error.
 */
async function executeStoryboardImport(
  taskId: string,
  params: {
    projectId: string;
    userId: string;
    text: string;
    llmHeaders: Record<string, string>;
  }
): Promise<void> {
  try {
    await taskService.updateTask(taskId, { status: 'processing', progress: 10 });

    const [charactersLib, locationsLib] = await Promise.all([
      assetService.getCharacterLibItems(params.projectId),
      assetService.getLocationLibItems(params.projectId),
    ]);

    await taskService.updateTask(taskId, { progress: 15 });

    const response = await startWorkflowRun('storyboardworkflow', {
      projectId: params.projectId,
      text: params.text,
      characters_lib: charactersLib,
      locations_lib: locationsLib,
    }, { llmHeaders: params.llmHeaders, timeoutMs: 540000 }); // 9 min

    const result = (await response.json()) as { content?: string };

    if (!result.content) {
      throw new Error('No content in workflow result');
    }

    const storyboardData = JSON.parse(result.content);

    await taskService.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      result: storyboardData,
    });

    logger.info({ taskId, projectId: params.projectId }, 'Storyboard import completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, taskId, projectId: params.projectId }, 'Storyboard import failed');

    await taskService.updateTask(taskId, {
      status: 'failed',
      error: {
        code: 'STORYBOARD_IMPORT_FAILED',
        message,
        retryable: true,
      },
    }).catch((updateErr) => {
      logger.error({ updateErr, taskId }, 'Failed to update task with error status');
    });
  }
}

/**
 * Import storyboard from text — calls AgentOS storyboardworkflow.
 * Returns 202 Accepted with taskId for async polling.
 * Also supports SSE streaming via `?stream=true` query param (legacy).
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

  // Legacy SSE streaming mode
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
        }, { stream: true, llmHeaders, timeoutMs: 300000 }); // 5 minutes

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

  // Async mode: create Task → return 202 → background execution
  const task = await taskService.createTask({
    type: 'storyboard_import',
    userId,
    input: { projectId, text: body.text },
    estimatedSeconds: 300,
  });

  // Fire-and-forget: execute in background
  executeStoryboardImport(task.id, { projectId, userId, text: body.text, llmHeaders }).catch((err) => {
    logger.error({ err, taskId: task.id }, 'Background storyboard import failed unexpectedly');
  });

  return c.json({ taskId: task.id }, 202);
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
