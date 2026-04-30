import { prisma } from '../lib/db';
import type { AppError } from '../lib/errors';

export interface ImageGenerationParams {
  name: string;
  description: string;
  style?: string;
  referenceImages?: string[];
  mode?: 'single' | 'sequence';
  assetType?: 'character' | 'location';
}

/**
 * Job Store Service — pure DB access for GenerationJob records.
 * No external dependencies beyond Prisma.
 */
export class JobStoreService {
  /**
   * List jobs with optional filtering and pagination
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
    } = { userId: params.userId };

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
   * Get a single job, throwing if not found or not owned by userId
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
   * Update job status / progress / result / error
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
   * Update queue positions for all queued jobs owned by userId
   */
  async updateQueuePositions(userId: string) {
    const queuedJobs = await prisma.generationJob.findMany({
      where: { userId, status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    await Promise.all(
      queuedJobs.map((job: { id: string }, index: number) =>
        prisma.generationJob.update({
          where: { id: job.id },
          data: { queuePosition: index + 1 },
        })
      )
    );
  }
}
