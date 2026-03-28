import { prisma } from '../lib/db';
import { runImageGeneration } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { LLMConfigService } from './llm-config.service';

export interface ImageGenerationParams {
  name: string;
  description: string;
  style?: string;
  referenceImages?: string[];
  mode?: 'single' | 'sequence';
  assetType?: 'character' | 'location';
}

export class GenerationJobService {
  /**
   * Create a new generation job and kick off image generation inline.
   * No BullMQ — runs via AgentOS HTTP call (fire-and-forget).
   */
  async createJob(data: {
    userId: string;
    projectId: string;
    storyboardId?: string;
    frameId?: string;
    params: ImageGenerationParams;
  }) {
    const job = await prisma.generationJob.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        storyboardId: data.storyboardId,
        frameId: data.frameId,
        params: data.params as any,
        status: 'queued',
        progress: 0,
      },
    });

    // Fire-and-forget: run image generation inline via AgentOS
    this.executeGeneration(job.id, data).catch((err) => {
      logger.error({ err, jobId: job.id }, 'Background image generation failed');
    });

    return job;
  }

  /**
   * Execute image generation via AgentOS (replaces BullMQ worker).
   */
  private async executeGeneration(
    jobId: string,
    data: {
      userId: string;
      projectId: string;
      params: ImageGenerationParams;
    }
  ) {
    try {
      await this.updateJob(jobId, { status: 'processing', progress: 10 });

      const llmHeaders = await new LLMConfigService().getLLMHeaders(data.userId, 'IMAGE_GEN');

      const result = await runImageGeneration({
        prompt: data.params.description,
        style: data.params.style,
        referenceImages: data.params.referenceImages,
      }, { llmHeaders });

      const firstImageUrl = result.images[0]?.url;

      await this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        resultUrl: firstImageUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      logger.error({ err, jobId }, 'Image generation failed');
      await this.updateJob(jobId, {
        status: 'failed',
        error: { code: 'GENERATION_ERROR', message, retryable: true },
      });
    }
  }

  /**
   * List jobs with filtering
   */
  async listJobs(params: {
    userId: string;
    status?: string | string[];
    projectId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: {
      userId: string;
      status?: { in: string[] } | string;
      projectId?: string;
    } = {
      userId: params.userId,
    };

    if (params.status) {
      where.status = Array.isArray(params.status)
        ? { in: params.status }
        : params.status;
    }

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    const [jobs, total] = await Promise.all([
      prisma.generationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      prisma.generationJob.count({ where }),
    ]);

    return { jobs, total };
  }

  /**
   * Get single job
   */
  async getJob(jobId: string, userId: string) {
    const job = await prisma.generationJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    return job;
  }

  /**
   * Update job status
   */
  async updateJob(
    jobId: string,
    data: {
      status?: string;
      progress?: number;
      queuePosition?: number;
      resultUrl?: string;
      error?: AppError;
    }
  ) {
    const { error, ...rest } = data;
    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        ...rest,
        error: error ? (error as any) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string, userId: string) {
    const job = await this.getJob(jobId, userId);

    if (job.status === 'canceled') {
      return job;
    }

    if (job.status === 'succeeded' || job.status === 'completed') {
      throw new Error('Job cannot be canceled');
    }

    if (job.status !== 'queued' && job.status !== 'processing' && job.status !== 'failed') {
      throw new Error('Job cannot be canceled');
    }

    return this.updateJob(jobId, { status: 'canceled' });
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string, userId: string) {
    const job = await this.getJob(jobId, userId);

    if (job.status !== 'failed') {
      throw new Error('Only failed jobs can be retried');
    }

    const error = job.error as AppError | null;
    if (error && error.retryable === false) {
      throw new Error('Job is not retryable');
    }

    const params = job.params as unknown as ImageGenerationParams;
    return this.createJob({
      userId: job.userId,
      projectId: job.projectId,
      storyboardId: job.storyboardId ?? undefined,
      frameId: job.frameId ?? undefined,
      params,
    });
  }

  /**
   * Update queue positions for queued jobs
   */
  async updateQueuePositions(userId: string) {
    const queuedJobs = await prisma.generationJob.findMany({
      where: {
        userId,
        status: 'queued',
      },
      orderBy: { createdAt: 'asc' },
    });

    const updates = queuedJobs.map((job: { id: string }, index: number) =>
      prisma.generationJob.update({
        where: { id: job.id },
        data: { queuePosition: index + 1 },
      })
    );

    await Promise.all(updates);
  }
}
