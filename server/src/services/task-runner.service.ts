import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import { TaskStoreService } from './task-store.service.js';
import { StorageService } from './storage.service.js';
import {
  getSdPool,
  isUnreachableError,
  NO_SD_WORKER_MESSAGE,
  SD_DEFAULT_STEPS,
  type SdPoolService,
} from './sd-pool.service.js';

export type GenerationKind = 'portrait' | 'location';

export interface CreateGenerationInput {
  userId: string;
  projectId: string;
  kind: GenerationKind;
  entityId: string;
  prompt: string;
  aspectRatio?: string;
}

export interface Txt2ImgInput {
  userId: string;
  projectId: string;
  kind: string;
  entityType: string;
  entityId: string;
  prompt: string;
  aspectRatio?: string | null;
  stickyKey?: string;
}

const KIND_ENTITY: Record<GenerationKind, 'character' | 'location'> = {
  portrait: 'character',
  location: 'location',
};

const ASPECT_SIZES: Record<string, { width: number; height: number }> = {
  '1:1': { width: 512, height: 512 },
  '16:9': { width: 768, height: 432 },
  '2.39:1': { width: 768, height: 432 },
  '9:16': { width: 432, height: 768 },
  '4:3': { width: 640, height: 480 },
  '3:4': { width: 480, height: 640 },
  '3:2': { width: 768, height: 512 },
  '2:3': { width: 512, height: 768 },
};

export function resolveTxt2ImgSize(aspectRatio?: string | null): { width: number; height: number } {
  if (!aspectRatio) return ASPECT_SIZES['1:1'];
  const key = aspectRatio.trim().replace('/', ':');
  return ASPECT_SIZES[key] ?? ASPECT_SIZES['1:1'];
}

/**
 * Creates GenerationTask rows and runs txt2img through the SD pool.
 * Portrait/location enqueue in the background; cinema awaits runTxt2Img.
 */
export class TaskRunnerService {
  private store: TaskStoreService;
  private pool: SdPoolService;
  private storage: StorageService;

  constructor(store?: TaskStoreService, pool?: SdPoolService, storage?: StorageService) {
    this.store = store ?? new TaskStoreService();
    this.pool = pool ?? getSdPool();
    this.storage = storage ?? new StorageService();
  }

  async createTask(data: CreateGenerationInput) {
    await this.assertEntity(data);

    const task = await this.insertTask({
      userId: data.userId,
      projectId: data.projectId,
      kind: data.kind,
      entityType: KIND_ENTITY[data.kind],
      entityId: data.entityId,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio ?? null,
    });

    this.executeTxt2Img(task.id, {
      userId: data.userId,
      projectId: data.projectId,
      kind: data.kind,
      entityType: KIND_ENTITY[data.kind],
      entityId: data.entityId,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio,
      stickyKey: data.entityId,
    })
      .then((url) => this.appendEntityImage(data, url))
      .catch((err) => {
        logger.error({ err, taskId: task.id }, 'Background SD generation failed');
      });

    return task;
  }

  /** Create a task and run txt2img to completion. Cinema frames use this. */
  async runTxt2Img(data: Txt2ImgInput): Promise<{ taskId: string; url: string }> {
    const task = await this.insertTask({
      userId: data.userId,
      projectId: data.projectId,
      kind: data.kind,
      entityType: data.entityType,
      entityId: data.entityId,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio ?? null,
    });
    const url = await this.executeTxt2Img(task.id, data);
    return { taskId: task.id, url };
  }

  async cancelTask(taskId: string, userId: string) {
    const task = await this.store.getTask(taskId, userId);

    if (task.status === 'canceled') {
      return task;
    }

    if (task.status !== 'queued' && task.status !== 'running') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Task cannot be canceled');
    }

    return this.store.updateTask(taskId, { status: 'canceled' });
  }

  async retryTask(taskId: string, userId: string) {
    const task = await this.store.getTask(taskId, userId);

    if (task.status !== 'failed') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Only failed tasks can be retried');
    }

    const error = task.error as { retryable?: boolean } | null;
    if (error && error.retryable === false) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Task is not retryable');
    }

    if (task.kind !== 'portrait' && task.kind !== 'location') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Task is not retryable');
    }
    if (!task.entityId) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Task is not retryable');
    }

    return this.createTask({
      userId: task.userId,
      projectId: task.projectId,
      kind: task.kind,
      entityId: task.entityId,
      prompt: task.prompt,
      aspectRatio: task.aspectRatio ?? undefined,
    });
  }

  private async insertTask(data: {
    userId: string;
    projectId: string;
    kind: string;
    entityType: string;
    entityId: string;
    prompt: string;
    aspectRatio: string | null;
  }) {
    return prisma.generationTask.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        kind: data.kind,
        entityType: data.entityType,
        entityId: data.entityId,
        prompt: data.prompt,
        aspectRatio: data.aspectRatio,
        status: 'queued',
        progress: 0,
      },
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

  private async executeTxt2Img(taskId: string, data: Txt2ImgInput): Promise<string> {
    const worker = await this.pool.pickWorker({
      capability: 'txt2img',
      stickyKey: data.stickyKey ?? data.entityId,
    });

    if (!worker) {
      await this.store.updateTaskIfActive(taskId, {
        status: 'failed',
        error: {
          code: 'NO_SD_WORKER',
          message: NO_SD_WORKER_MESSAGE,
          retryable: true,
        },
      });
      throw new AppException(ErrorCode.GENERATION_ERROR, NO_SD_WORKER_MESSAGE);
    }

    try {
      const started = await this.store.updateTaskIfActive(taskId, {
        status: 'running',
        progress: 10,
        workerId: worker.id,
      });
      if (!started) {
        logger.info({ taskId }, 'Skip generation — task is no longer active');
        throw new AppException(ErrorCode.INVALID_INPUT, 'Task is no longer active');
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
      const url = apiFileUrl(this.storage, data.projectId, stored.path, stored.url);

      await prisma.asset.create({
        data: {
          projectId: data.projectId,
          kind: data.kind,
          entityType: data.entityType,
          entityId: data.entityId,
          url,
          taskId,
        },
      });

      const finished = await this.store.updateTaskIfActive(taskId, {
        status: 'completed',
        progress: 100,
        resultUrl: url,
        workerId: worker.id,
      });
      if (!finished) {
        logger.info({ taskId }, 'Skip success write — task was canceled during generation');
      }
      return url;
    } catch (err) {
      if (err instanceof AppException) throw err;
      logger.error({ err, taskId }, 'SD image generation failed');
      const failure = generationFailure(err);
      await this.store.updateTaskIfActive(taskId, {
        status: 'failed',
        error: failure,
      });
      throw new AppException(ErrorCode.GENERATION_ERROR, failure.message);
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

export function generationFailure(err: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  const message = err instanceof Error ? err.message : 'Image generation failed';
  if (message === NO_SD_WORKER_MESSAGE || isUnreachableError(err)) {
    return { code: 'NO_SD_WORKER', message: NO_SD_WORKER_MESSAGE, retryable: true };
  }
  return { code: 'GENERATION_ERROR', message, retryable: true };
}

function apiFileUrl(
  storage: StorageService,
  projectId: string,
  storagePath: string,
  fallback: string
): string {
  const name = storagePath.split('/').pop();
  return name ? storage.publicApiUrl(projectId, name) : fallback;
}

function appendImage(current: unknown, url: string): Array<{ url: string }> {
  const list = Array.isArray(current) ? [...current] : [];
  list.push({ url });
  return list as Array<{ url: string }>;
}
