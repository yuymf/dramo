import { prisma } from '../lib/db';
import { runImageGeneration } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import { LLMConfigService } from './llm-config.service';
import { JobStoreService } from './job-store.service';
import type { ImageGenerationParams } from './job-store.service';

/**
 * Job Runner Service — handles fire-and-forget execution and retry lifecycle.
 * Delegates all DB mutations to JobStoreService.
 */
export class JobRunnerService {
  private store: JobStoreService;

  constructor(store?: JobStoreService) {
    this.store = store ?? new JobStoreService();
  }

  /**
   * Create a new generation job record and kick off async execution.
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

    // Fire-and-forget: run image generation via AgentOS
    this.executeGeneration(job.id, data).catch((err) => {
      logger.error({ err, jobId: job.id }, 'Background image generation failed');
    });

    return job;
  }

  /**
   * Cancel a queued or running job.
   */
  async cancelJob(jobId: string, userId: string) {
    const job = await this.store.getJob(jobId, userId);

    if (job.status === 'canceled') {
      return job;
    }

    if (job.status === 'succeeded' || job.status === 'failed') {
      throw new Error('Job cannot be canceled');
    }

    if (job.status !== 'queued' && job.status !== 'running') {
      throw new Error('Job cannot be canceled');
    }

    return this.store.updateJob(jobId, { status: 'canceled' });
  }

  /**
   * Retry a failed job by creating a new one with the same params.
   */
  async retryJob(jobId: string, userId: string) {
    const job = await this.store.getJob(jobId, userId);

    if (job.status !== 'failed') {
      throw new Error('Only failed jobs can be retried');
    }

    const error = job.error as { retryable?: boolean } | null;
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
   * Execute image generation via AgentOS and update job status throughout.
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
      const started = await this.store.updateJobIfActive(jobId, { status: 'running', progress: 10 });
      if (!started) {
        logger.info({ jobId }, 'Skip generation — job is no longer active');
        return;
      }

      const llmHeaders = await new LLMConfigService().getLLMHeaders(data.userId, 'IMAGE_GEN');

      const result = await runImageGeneration({
        prompt: data.params.description,
        style: data.params.style,
        referenceImages: data.params.referenceImages,
      }, { llmHeaders });

      const firstImageUrl = result.images[0]?.url;

      const finished = await this.store.updateJobIfActive(jobId, {
        status: 'succeeded',
        progress: 100,
        resultUrl: firstImageUrl,
      });
      if (!finished) {
        logger.info({ jobId }, 'Skip success write — job was canceled during generation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      logger.error({ err, jobId }, 'Image generation failed');
      await this.store.updateJobIfActive(jobId, {
        status: 'failed',
        error: { code: 'GENERATION_ERROR', message, retryable: true },
      });
    }
  }
}
