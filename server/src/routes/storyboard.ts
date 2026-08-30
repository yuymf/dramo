import { Hono } from 'hono';
import { StoryboardService } from '../services/storyboard.service';
import { StoryboardDataService } from '../services/storyboard-data.service';
import type { FrameData } from '../services/storyboard-data.service';
import { CharacterAssetService } from '../services/character-asset.service';
import { LocationAssetService } from '../services/location-asset.service';
import { TaskService } from '../services/task.service';
import { startWorkflowRun } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';
import { AppException, ErrorCode } from '../lib/errors';
import { prisma } from '../lib/db';

const storyboard = new Hono<AuthEnv>();
const storyboardService = new StoryboardService();
const storyboardDataService = new StoryboardDataService();
const characterAssetService = new CharacterAssetService();
const locationAssetService = new LocationAssetService();
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
    characterAssetService.getCharacterLibItems(projectId),
    locationAssetService.getLocationLibItems(projectId),
  ]);
}

/**
 * Convert AgentOS storyboard JSON (scenes[].shots[]) → FrameData[].
 * Mirrors the storyboardJsonToFrames() utility on the frontend.
 */
function storyboardJsonToFrames(data: {
  scenes?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    shots?: Array<Record<string, unknown>>;
  }>;
}): FrameData[] {
  const frames: FrameData[] = [];
  let order = 1;

  (data.scenes ?? []).forEach((scene) => {
    (scene.shots ?? []).forEach((shot) => {
      const isEXT = (scene.title ?? '').toUpperCase().includes('EXT');
      const isNight =
        (scene.title ?? '').includes('夜') ||
        (scene.title ?? '').toUpperCase().includes('NIGHT');

      const shotNumber = (shot.shot_number as string | undefined) ?? String(order);

      frames.push({
        id: `${scene.id ?? 'scene'}-${shotNumber}`,
        order: order++,
        title: scene.title ?? '',
        sceneType: isEXT ? 'EXT.' : 'INT.',
        timeOfDay: isNight ? '夜' : '日',
        description: scene.summary ?? '',
        bulletPoints: [],
        shot_number: shotNumber,
        shot_size: shot.shot_size as string | undefined,
        duration_seconds: shot.duration_seconds as number | undefined,
        scene_description: shot.scene_description as string | undefined,
        director_notes: shot.director_notes as string | undefined,
        audio_description: shot.audio_description as string | undefined,
        camera_angle: shot.camera_angle as string | undefined,
        camera_movement: shot.camera_movement as string | undefined,
        focal_length: shot.focal_length as string | undefined,
        characters: (shot.characters as string[] | undefined) ?? [],
        locations: (shot.locations as string[] | undefined) ?? [],
        dialogues: (shot.dialogues as FrameData['dialogues']) ?? [],
        prompts: (shot.prompts as FrameData['prompts']) ?? {},
      });
    });
  });

  return frames;
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

    // Use stream:true so AgentOS sends SSE keep-alive events during the long
    // 4-phase pipeline — prevents Node.js undici bodyTimeout from killing
    // the connection before the workflow finishes (typically 3-5 minutes).
    const response = await startWorkflowRun('storyboardworkflow', {
      projectId: params.projectId,
      text: params.text,
      characters_lib: charactersLib,
      locations_lib: locationsLib,
    }, { llmHeaders: params.llmHeaders, timeoutMs: WORKFLOW_TIMEOUT_MS, stream: true });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`AgentOS returned ${response.status}: ${errorText}`);
    }

    // Consume SSE stream; last `data:` event contains the final result
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from AgentOS');

    const decoder = new TextDecoder();
    let buffer = '';
    let lastContent: string | null = null;
    let eventCount = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw) as { content?: string; event?: string; status?: string };
            eventCount++;
            // AgentOS SSE: final event has event="WorkflowCompleted" and content field
            if (evt.content && (
              evt.event === 'WorkflowCompleted' ||
              evt.status === 'COMPLETED' ||
              evt.status === 'completed'
            )) {
              lastContent = evt.content;
            } else if (evt.content) {
              lastContent = evt.content; // keep last seen content as fallback
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    logger.info({ taskId, eventCount }, 'Storyboard SSE stream complete');

    if (!lastContent) {
      throw new Error('No content received from storyboard workflow SSE stream');
    }

    let storyboardData: unknown;
    try {
      storyboardData = JSON.parse(lastContent);
    } catch {
      throw new Error('Failed to parse storyboard data from workflow SSE result');
    }

    if (!storyboardData || typeof storyboardData !== 'object') {
      throw new Error('Invalid storyboard data structure from workflow');
    }

    // Convert AgentOS JSON → FrameData[] and persist to the storyboard table
    // so the frontend can retrieve it via GET /api/projects/:id/storyboard-data.
    const frames = storyboardJsonToFrames(
      storyboardData as { scenes?: Array<Record<string, unknown>> }
    );
    if (frames.length > 0) {
      await storyboardDataService.saveStoryboard(params.projectId, frames);
      logger.info({ taskId, frames: frames.length }, 'Storyboard frames saved to DB');
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
storyboard.post('/projects/:projectId/storyboard/import', async (c) => {
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

storyboard.get('/projects/:projectId/storyboard/frames/images', async (c) => {
  const projectId = c.req.param('projectId');
  const images = await storyboardService.getFrameImages(projectId);
  return c.json({ success: true, images });
});

storyboard.put('/projects/:projectId/storyboard/frames/:frameId/image', async (c) => {
  const projectId = c.req.param('projectId');
  const frameId = c.req.param('frameId');
  const { image } = await c.req.json();

  await storyboardService.setFrameImage(projectId, frameId, image);
  return c.json({ success: true });
});

export { storyboard };
