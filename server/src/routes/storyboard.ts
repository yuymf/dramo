import { Hono } from 'hono';
import { StoryboardService } from '../services/storyboard.service';
import { AssetService } from '../services/asset.service';
import { TaskService } from '../services/task.service';
import { startWorkflowRun } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';
import { AppException, ErrorCode } from '../lib/errors';
import { prisma } from '../lib/db';

const storyboard = new Hono<AuthEnv>();
const storyboardService = new StoryboardService();
const assetService = new AssetService();
const llmConfigService = new LLMConfigService();
const taskService = new TaskService();

/** Timeout for the background AgentOS workflow call (9 minutes) */
const WORKFLOW_TIMEOUT_MS = 540_000;

/** Estimated time for the full storyboard pipeline */
const ESTIMATED_PIPELINE_SECONDS = 300;

/**
 * Fetch project assets needed for storyboard generation.
 */
async function fetchProjectAssets(projectId: string) {
  return Promise.all([
    assetService.getCharacterLibItems(projectId),
    assetService.getLocationLibItems(projectId),
  ]);
}

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

    const [charactersLib, locationsLib] = await fetchProjectAssets(params.projectId);

    await taskService.updateTask(taskId, { progress: 15 });

    const response = await startWorkflowRun('storyboardworkflow', {
      projectId: params.projectId,
      text: params.text,
      characters_lib: charactersLib,
      locations_lib: locationsLib,
    }, { llmHeaders: params.llmHeaders, timeoutMs: WORKFLOW_TIMEOUT_MS });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`AgentOS returned ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as { content?: string };

    if (!result.content) {
      throw new Error('No content in workflow result');
    }

    let storyboardData: unknown;
    try {
      storyboardData = JSON.parse(result.content);
    } catch {
      throw new Error('Failed to parse storyboard data from workflow result');
    }

    if (!storyboardData || typeof storyboardData !== 'object') {
      throw new Error('Invalid storyboard data structure from workflow');
    }

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
        code: ErrorCode.GENERATION_ERROR,
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
 * Returns 202 Accepted with taskId. Frontend polls GET /api/tasks/:taskId.
 */
storyboard.post('/api/projects/:projectId/storyboard/import', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const userId = c.get('user').userId;

  if (!body?.text) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'Missing text in request body');
  }

  // Authorization: verify caller owns the project (BOLA prevention)
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  // Async mode: create Task → return 202 → background execution
  const task = await taskService.createTask({
    type: 'storyboard_import',
    userId,
    input: { projectId, text: body.text },
    estimatedSeconds: ESTIMATED_PIPELINE_SECONDS,
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
