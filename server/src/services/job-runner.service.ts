import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { AppException, ErrorCode } from '../lib/errors';
import { JobStoreService } from './job-store.service';
import { StorageService } from './storage.service';
import {
  getSdPool,
  NO_SD_WORKER_MESSAGE,
  SD_DEFAULT_STEPS,
  type SdPoolService,
} from './sd-pool.service';

export type GenerationKind = 'portrait' | 'location';

export interface CreateGenerationInput {
  userId: string;
  projectId: string;
  kind: GenerationKind;
  entityId: string;
  prompt: string;
  aspectRatio?: string;
}

const KIND_ENTITY: Record<GenerationKind, 'character' | 'location'> = {
  portrait: 'character',
  location: 'location',
};

const ASPECT_SIZES: Record<string, { width: number; height: number }> = {
  '1:1': { width: 512, height: 512 },
  '16:9': { width: 768, height: 432 },
  '9:16': { width: 432, height: 768 },
  '4:3': { width: 640, height: 480 },
  '3:4': { width: 480, height: 640 },
  '3:2': { width: 768, height: 512 },
  '2:3': { width: 512, height: 768 },
};

export function resolveTxt2ImgSize(aspectRatio?: string): { width: number; height: number } {
  if (!aspectRatio) return ASPECT_SIZES['1:1'];
  const key = aspectRatio.trim().replace('/', ':');
  return ASPECT_SIZES[key] ?? ASPECT_SIZES['1:1'];
}

/**
 * Job Runner — creates GenerationTask rows and executes them via the SD pool.
 * Seedream / AgentOS runImageGeneration is not used.
 */
export class JobRunnerService {
  private store: JobStoreService;
  private pool: SdPoolService;
  private storage: StorageService;

  constructor(store?: JobStoreService, pool?: SdPoolService, storage?: StorageService) {
    this.store = store ?? new JobStoreService();
    this.pool = pool ?? getSdPool();
    this.storage = storage ?? new StorageService();
  }

  async createJob(data: CreateGenerationInput) {
    await this.assertEntity(data);

    const entityType = KIND_ENTITY[data.kind];
    const task = await prisma.generationTask.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        kind: data.kind,
        entityType,
        entityId: data.entityId,
        prompt: data.prompt,
        aspectRatio: data.aspectRatio ?? null,
        status: 'queued',
        progress: 0,
      },
    });

    this.executeGeneration(task.id, data).catch((err) => {
      logger.error({ err, taskId: task.id }, 'Background SD generation failed');
    });

    return task;
  }

  async cancelJob(jobId: string, userId: string) {
    const job = await this.store.getJob(jobId, userId);

    if (job.status === 'canceled') {
      return job;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error('Job cannot be canceled');
    }

    if (job.status !== 'queued' && job.status !== 'running') {
      throw new Error('Job cannot be canceled');
    }

    return this.store.updateJob(jobId, { status: 'canceled' });
  }

  async retryJob(jobId: string, userId: string) {
    const job = await this.store.getJob(jobId, userId);

    if (job.status !== 'failed') {
      throw new Error('Only failed jobs can be retried');
    }

    const error = job.error as { retryable?: boolean } | null;
    if (error && error.retryable === false) {
      throw new Error('Job is not retryable');
    }

    if (job.kind !== 'portrait' && job.kind !== 'location') {
      throw new Error('Job is not retryable');
    }
    if (!job.entityId) {
      throw new Error('Job is not retryable');
    }

    return this.createJob({
      userId: job.userId,
      projectId: job.projectId,
      kind: job.kind,
      entityId: job.entityId,
      prompt: job.prompt,
      aspectRatio: job.aspectRatio ?? undefined,
    });
  }

  private async assertEntity(data: CreateGenerationInput) {
    if (data.kind === 'portrait') {
      const character = await prisma.character.findFirst({
        where: { id: data.entityId, projectId: data.projectId },
      });
      if (!character) {
        throw new AppException(ErrorCode.NOT_FOUND, 'Character not found');
      }
      return;
    }

    const location = await prisma.location.findFirst({
      where: { id: data.entityId, projectId: data.projectId },
    });
    if (!location) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Location not found');
    }
  }

  private async executeGeneration(taskId: string, data: CreateGenerationInput) {
    const worker = await this.pool.pickWorker({
      capability: 'txt2img',
      stickyKey: data.entityId,
    });

    if (!worker) {
      await this.store.updateJobIfActive(taskId, {
        status: 'failed',
        error: {
          code: 'NO_SD_WORKER',
          message: NO_SD_WORKER_MESSAGE,
          retryable: true,
        },
      });
      return;
    }

    try {
      const started = await this.store.updateJobIfActive(taskId, {
        status: 'running',
        progress: 10,
        workerId: worker.id,
      });
      if (!started) {
        logger.info({ taskId }, 'Skip generation — task is no longer active');
        return;
      }

      const size = resolveTxt2ImgSize(data.aspectRatio);
      const base64 = await this.pool.txt2img(worker, {
        prompt: data.prompt,
        width: size.width,
        height: size.height,
        steps: SD_DEFAULT_STEPS,
      });

      const stored = await this.storage.uploadImageFromBase64(
        data.projectId,
        base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
      );

      await prisma.asset.create({
        data: {
          projectId: data.projectId,
          kind: data.kind,
          entityType: KIND_ENTITY[data.kind],
          entityId: data.entityId,
          url: stored.url,
          taskId,
        },
      });

      await this.appendEntityImage(data, stored.url);

      const finished = await this.store.updateJobIfActive(taskId, {
        status: 'completed',
        progress: 100,
        resultUrl: stored.url,
        workerId: worker.id,
      });
      if (!finished) {
        logger.info({ taskId }, 'Skip success write — task was canceled during generation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      logger.error({ err, taskId }, 'SD image generation failed');
      await this.store.updateJobIfActive(taskId, {
        status: 'failed',
        error: { code: 'GENERATION_ERROR', message, retryable: true },
      });
    } finally {
      this.pool.release(worker.id);
    }
  }

  private async appendEntityImage(data: CreateGenerationInput, url: string) {
    if (data.kind === 'portrait') {
      const character = await prisma.character.findFirst({
        where: { id: data.entityId, projectId: data.projectId },
      });
      if (!character) return;
      const images = appendImage(character.images, url);
      await prisma.character.update({
        where: { id: character.id },
        data: { images: images as object },
      });
      return;
    }

    const location = await prisma.location.findFirst({
      where: { id: data.entityId, projectId: data.projectId },
    });
    if (!location) return;
    const images = appendImage(location.images, url);
    await prisma.location.update({
      where: { id: location.id },
      data: { images: images as object },
    });
  }
}

function appendImage(current: unknown, url: string): Array<{ url: string }> {
  const list = Array.isArray(current) ? [...current] : [];
  list.push({ url });
  return list as Array<{ url: string }>;
}
