import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import { prisma } from '../lib/db.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import {
  DEFAULT_CINEMA_SETTINGS,
  FILM_DURATION_SEC,
  NO_IMAGES_MESSAGE,
  NO_PERFORMANCE_MESSAGE,
  NO_SHOTS_MESSAGE,
  NOT_CINEMA_MESSAGE,
  deriveReelStage,
  hasPerformance,
  normalizeCinemaSettings,
  parsePerformance,
  placeholderStoryboardShots,
  type CinemaAssistTarget,
  type CinemaSettings,
  type ReelFilmRecord,
  type ReelImage,
  type ReelShot,
} from '../types/cinema.js';
import { ScreenplayService } from './screenplay.service.js';
import { StorageService } from './storage.service.js';
import { encodeFifteenSecondFilm, NO_VIDEO_ENCODER_MESSAGE } from './cinema-video.service.js';
import { TaskRunnerService } from './task-runner.service.js';

export interface ReelDoc {
  id: string;
  episodeId: string;
  name: string;
  sortOrder: number;
  sceneText: string;
  performance: string;
  shots: ReelShot[];
  images: ReelImage[];
  lastFrameUrl: string | null;
  previousReelId: string | null;
  films: ReelFilmRecord[];
  stage: ReturnType<typeof deriveReelStage>;
  parsed: ReturnType<typeof parsePerformance>;
}

export class CinemaService {
  private screenplay = new ScreenplayService();
  private storage: StorageService;
  private runner: TaskRunnerService;

  constructor(storage?: StorageService, runner?: TaskRunnerService) {
    this.storage = storage ?? new StorageService();
    this.runner = runner ?? new TaskRunnerService(undefined, undefined, this.storage);
  }

  private async requireCinema(
    projectId: string,
    userId: string,
    options?: { write?: boolean }
  ) {
    await this.screenplay.requireAccess(projectId, userId, options);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, type: true, cinemaSettings: true },
    });
    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, '项目不存在');
    }
    if (project.type !== 'cinema') {
      throw new AppException(ErrorCode.INVALID_INPUT, NOT_CINEMA_MESSAGE);
    }
    return project;
  }

  private async requireReel(projectId: string, reelId: string, userId: string, options?: { write?: boolean }) {
    const project = await this.requireCinema(projectId, userId, options);
    const reel = await prisma.reel.findFirst({
      where: { id: reelId, episode: { projectId } },
      include: { films: { orderBy: { createdAt: 'desc' } } },
    });
    if (!reel) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Reel 不存在');
    }
    return { project, reel };
  }

  async listReels(projectId: string, episodeId: string, userId: string) {
    await this.requireCinema(projectId, userId);
    const episode = await prisma.episode.findFirst({ where: { id: episodeId, projectId } });
    if (!episode) {
      throw new AppException(ErrorCode.NOT_FOUND, '集不存在');
    }
    const rows = await prisma.reel.findMany({
      where: { episodeId },
      include: { films: { orderBy: { createdAt: 'desc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return { reels: rows.map(toReelDoc) };
  }

  async createReel(
    projectId: string,
    episodeId: string,
    userId: string,
    input: { name?: string; previousReelId?: string | null }
  ) {
    await this.requireCinema(projectId, userId, { write: true });
    const episode = await prisma.episode.findFirst({ where: { id: episodeId, projectId } });
    if (!episode) {
      throw new AppException(ErrorCode.NOT_FOUND, '集不存在');
    }
    const last = await prisma.reel.findFirst({
      where: { episodeId },
      orderBy: { sortOrder: 'desc' },
    });
    if (input.previousReelId) {
      const prev = await prisma.reel.findFirst({
        where: { id: input.previousReelId, episodeId },
      });
      if (!prev) {
        throw new AppException(ErrorCode.INVALID_INPUT, '上一 Reel 不存在');
      }
    }
    const created = await prisma.reel.create({
      data: {
        episodeId,
        name: input.name?.trim() || `Reel ${(last?.sortOrder ?? -1) + 2}`,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        previousReelId: input.previousReelId ?? last?.id ?? null,
      },
      include: { films: true },
    });
    return toReelDoc(created);
  }

  async getReel(projectId: string, reelId: string, userId: string) {
    const { reel } = await this.requireReel(projectId, reelId, userId);
    return toReelDoc(reel);
  }

  async patchReel(
    projectId: string,
    reelId: string,
    userId: string,
    input: {
      name?: string;
      sceneText?: string;
      performance?: string;
      shots?: ReelShot[];
      previousReelId?: string | null;
    }
  ) {
    const { reel } = await this.requireReel(projectId, reelId, userId, { write: true });
    if (input.shots && !hasPerformance(input.performance ?? reel.performance)) {
      throw new AppException(ErrorCode.INVALID_INPUT, NO_PERFORMANCE_MESSAGE);
    }
    if (input.previousReelId) {
      const prev = await prisma.reel.findFirst({
        where: { id: input.previousReelId, episodeId: reel.episodeId },
      });
      if (!prev) {
        throw new AppException(ErrorCode.INVALID_INPUT, '上一 Reel 不存在');
      }
    }
    const updated = await prisma.reel.update({
      where: { id: reel.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() || reel.name } : {}),
        ...(input.sceneText !== undefined ? { sceneText: input.sceneText } : {}),
        ...(input.performance !== undefined ? { performance: input.performance } : {}),
        ...(input.shots !== undefined ? { shots: input.shots as unknown as Prisma.InputJsonValue } : {}),
        ...(input.previousReelId !== undefined ? { previousReelId: input.previousReelId } : {}),
      },
      include: { films: { orderBy: { createdAt: 'desc' } } },
    });
    if (input.performance !== undefined) {
      await deriveFromPerformance(projectId, input.performance);
    }
    return toReelDoc(updated);
  }

  async generateStoryboard(projectId: string, reelId: string, userId: string) {
    const { reel } = await this.requireReel(projectId, reelId, userId, { write: true });
    if (!hasPerformance(reel.performance)) {
      throw new AppException(ErrorCode.INVALID_INPUT, NO_PERFORMANCE_MESSAGE);
    }
    const shots = placeholderStoryboardShots(reel.sceneText, reel.performance);
    const updated = await prisma.reel.update({
      where: { id: reel.id },
      data: { shots: shots as unknown as Prisma.InputJsonValue, images: [] },
      include: { films: { orderBy: { createdAt: 'desc' } } },
    });
    return toReelDoc(updated);
  }

  async generateImages(projectId: string, reelId: string, userId: string) {
    const { project, reel } = await this.requireReel(projectId, reelId, userId, { write: true });
    const shots = asShots(reel.shots);
    if (shots.length === 0) {
      throw new AppException(ErrorCode.INVALID_INPUT, NO_SHOTS_MESSAGE);
    }
    const settings = normalizeCinemaSettings(project.cinemaSettings);
    const images: ReelImage[] = [];
    for (const shot of shots) {
      const { taskId, url } = await this.runner.runTxt2Img({
        userId,
        projectId,
        kind: 'cinema_frame',
        entityType: 'reel',
        entityId: reel.id,
        prompt: framePrompt(settings, shot),
        aspectRatio: settings.aspectRatio,
        stickyKey: reel.id,
      });
      images.push({ shotId: shot.id, url, taskId });
    }
    const updated = await prisma.reel.update({
      where: { id: reel.id },
      data: { images: images as unknown as Prisma.InputJsonValue },
      include: { films: { orderBy: { createdAt: 'desc' } } },
    });
    return toReelDoc(updated);
  }

  async generateFilm(projectId: string, reelId: string, userId: string) {
    const { project, reel } = await this.requireReel(projectId, reelId, userId, { write: true });
    const images = asImages(reel.images);
    if (images.length === 0) {
      throw new AppException(ErrorCode.INVALID_INPUT, NO_IMAGES_MESSAGE);
    }
    const settings = normalizeCinemaSettings(project.cinemaSettings);
    const imagePaths: string[] = [];
    if (reel.previousReelId) {
      const prev = await prisma.reel.findFirst({
        where: { id: reel.previousReelId, episode: { projectId } },
      });
      if (prev?.lastFrameUrl) {
        const anchor = this.storage.resolveLocalPath(prev.lastFrameUrl);
        if (anchor) imagePaths.push(anchor);
      }
    }
    for (const image of images) {
      const local = this.storage.resolveLocalPath(image.url);
      if (!local) {
        throw new AppException(ErrorCode.GENERATION_ERROR, '分镜图文件不在本地存储');
      }
      imagePaths.push(local);
    }

    const task = await prisma.generationTask.create({
      data: {
        userId,
        projectId,
        kind: 'cinema_film',
        entityType: 'reel',
        entityId: reel.id,
        prompt: `15 秒成片 · ${reel.name}`,
        aspectRatio: settings.aspectRatio,
        status: 'running',
        progress: 20,
      },
    });

    const filmName = `${crypto.randomUUID()}.mp4`;
    const lastName = `${crypto.randomUUID()}.png`;
    const workDir = path.resolve(config.storageLocalDir, 'projects', projectId);
    const filmPath = path.join(workDir, filmName);
    const lastPath = path.join(workDir, lastName);

    try {
      await mkdir(workDir, { recursive: true });
      await encodeFifteenSecondFilm({
        imagePaths,
        outputPath: filmPath,
        lastFramePath: lastPath,
        aspectRatio: settings.aspectRatio,
      });
      const filmUrl = this.storage.publicApiUrl(projectId, filmName);
      const lastUrl = this.storage.publicApiUrl(projectId, lastName);
      await prisma.reelFilm.create({
        data: { reelId: reel.id, url: filmUrl, durationSec: FILM_DURATION_SEC },
      });
      await prisma.asset.create({
        data: {
          projectId,
          kind: 'cinema_film',
          entityType: 'reel',
          entityId: reel.id,
          url: filmUrl,
          taskId: task.id,
        },
      });
      await prisma.generationTask.update({
        where: { id: task.id },
        data: { status: 'completed', progress: 100, resultUrl: filmUrl },
      });
      const updated = await prisma.reel.update({
        where: { id: reel.id },
        data: { lastFrameUrl: lastUrl },
        include: { films: { orderBy: { createdAt: 'desc' } } },
      });
      return toReelDoc(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : NO_VIDEO_ENCODER_MESSAGE;
      await prisma.generationTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          error: { code: 'NO_VIDEO_ENCODER', message, retryable: true },
        },
      });
      throw new AppException(
        message === NO_VIDEO_ENCODER_MESSAGE ? ErrorCode.GENERATION_ERROR : ErrorCode.GENERATION_ERROR,
        message === '没有分镜图不能出成片' ? NO_IMAGES_MESSAGE : message
      );
    }
  }

  async assist(
    projectId: string,
    reelId: string,
    userId: string,
    input: { target: CinemaAssistTarget; instruction: string }
  ) {
    const { reel } = await this.requireReel(projectId, reelId, userId, { write: true });
    if (!input.instruction.trim()) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'instruction 不能为空');
    }
    return {
      reel: toReelDoc(reel),
      applied: false,
      message: '已看过当前 Reel，没有改写（无可用模型时不编造）',
    };
  }
}

export async function deriveFromPerformance(projectId: string, text: string): Promise<void> {
  const parsed = parsePerformance(text);
  const writes: Promise<unknown>[] = [];
  for (const name of parsed.characters) {
    writes.push(
      prisma.character.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      })
    );
  }
  for (const name of parsed.props) {
    writes.push(
      prisma.prop.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      })
    );
  }
  if (writes.length > 0) {
    await Promise.all(writes);
  }
}

function framePrompt(settings: CinemaSettings, shot: ReelShot): string {
  return [settings.artStyle, settings.cameraStyle, settings.productionKind, shot.camera, shot.description]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

function asShots(raw: unknown): ReelShot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
        description: typeof row.description === 'string' ? row.description : '',
        camera: typeof row.camera === 'string' ? row.camera : '',
      };
    });
}

function asImages(raw: unknown): ReelImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string')
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        shotId: typeof row.shotId === 'string' ? row.shotId : '',
        url: String(row.url),
        taskId: typeof row.taskId === 'string' ? row.taskId : undefined,
      };
    });
}

function asFilms(raw: Array<{ id: string; url: string; durationSec: number; createdAt: Date }>): ReelFilmRecord[] {
  return raw.map((row) => ({
    id: row.id,
    url: row.url,
    durationSec: row.durationSec,
    createdAt: row.createdAt.toISOString(),
  }));
}

function toReelDoc(row: {
  id: string;
  episodeId: string;
  name: string;
  sortOrder: number;
  sceneText: string;
  performance: string;
  shots: unknown;
  images: unknown;
  lastFrameUrl: string | null;
  previousReelId: string | null;
  films: Array<{ id: string; url: string; durationSec: number; createdAt: Date }>;
}): ReelDoc {
  const shots = asShots(row.shots);
  const images = asImages(row.images);
  const films = asFilms(row.films);
  return {
    id: row.id,
    episodeId: row.episodeId,
    name: row.name,
    sortOrder: row.sortOrder,
    sceneText: row.sceneText,
    performance: row.performance,
    shots,
    images,
    lastFrameUrl: row.lastFrameUrl,
    previousReelId: row.previousReelId,
    films,
    stage: deriveReelStage({ performance: row.performance, shots, images, films }),
    parsed: parsePerformance(row.performance),
  };
}

export { DEFAULT_CINEMA_SETTINGS };
