import { Hono } from 'hono';
import { StoryboardService } from '../services/storyboard.service';
import { StoryboardDataService } from '../services/storyboard-data.service';
import type { FrameData } from '../services/storyboard-data.service';
import { CharacterAssetService } from '../services/character-asset.service';
import { LocationAssetService } from '../services/location-asset.service';
import { startWorkflowRun } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';
import { JobStoreService } from '../services/job-store.service';
import { AppException, ErrorCode } from '../lib/errors';
import { prisma } from '../lib/db';

const storyboard = new Hono<AuthEnv>();
const storyboardService = new StoryboardService();
const storyboardDataService = new StoryboardDataService();
const characterAssetService = new CharacterAssetService();
const locationAssetService = new LocationAssetService();
const llmConfigService = new LLMConfigService();
const jobStore = new JobStoreService();

/** Timeout for the background AgentOS workflow call (9 minutes) */
const WORKFLOW_TIMEOUT_MS = 540_000;

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
 * Updates GenerationJob with progress/result/error.
 */
async function executeStoryboardImport(
  jobId: string,
  params: {
    projectId: string;
    userId: string;
    text: string;
    llmHeaders: Record<string, string>;
  }
): Promise<void> {
  try {
    const started = await jobStore.updateJobIfActive(jobId, { status: 'running', progress: 10 });
    if (!started) {
      logger.info({ jobId }, 'Skip storyboard import — job is no longer active');
      return;
    }

    const [charactersLib, locationsLib] = await fetchProjectAssets(params.projectId);

    await jobStore.updateJobIfActive(jobId, { progress: 15 });

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

    logger.info({ jobId, eventCount }, 'Storyboard SSE stream complete');

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
      logger.info({ jobId, frames: frames.length }, 'Storyboard frames saved to DB');
    }

    await jobStore.updateJobIfActive(jobId, {
      status: 'succeeded',
      progress: 100,
      result: storyboardData,
    });

    logger.info({ jobId, projectId: params.projectId }, 'Storyboard import completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, jobId, projectId: params.projectId }, 'Storyboard import failed');

    await jobStore.updateJobIfActive(jobId, {
      status: 'failed',
      error: {
        code: ErrorCode.GENERATION_ERROR,
        message,
        retryable: true,
      },
    }).catch((updateErr) => {
      logger.error({ updateErr, jobId }, 'Failed to update job with error status');
    });
  }
}

/**
 * Import storyboard from text — calls AgentOS storyboardworkflow.
 * Returns 202 Accepted with jobId. Frontend polls GET /api/jobs/:jobId.
 */
storyboard.post('/projects/:projectId/storyboard/import', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const userId = c.get('user').userId;

  if (!body?.text) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'Missing text in request body');
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  const job = await prisma.generationJob.create({
    data: {
      userId,
      projectId,
      type: 'storyboard_import',
      params: { text: body.text },
      status: 'queued',
      progress: 0,
    },
  });

  executeStoryboardImport(job.id, { projectId, userId, text: body.text, llmHeaders }).catch((err) => {
    logger.error({ err, jobId: job.id }, 'Background storyboard import failed unexpectedly');
  });

  return c.json({ jobId: job.id }, 202);
});

storyboard.put('/projects/:projectId/storyboard/frames/:frameId/image', async (c) => {
  const projectId = c.req.param('projectId');
  const frameId = c.req.param('frameId');
  const { image } = await c.req.json();

  await storyboardService.setFrameImage(projectId, frameId, image);
  return c.json({ success: true });
});

export { storyboard };
