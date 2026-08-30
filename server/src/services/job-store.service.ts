import { prisma } from '../lib/db';
import type { AppError } from '../lib/errors';

export interface GenerationTaskUpdate {
  status?: string;
  progress?: number;
  workerId?: string;
  resultUrl?: string;
  error?: AppError;
  retryCount?: number;
}

/**
 * Job Store Service — DB access for GenerationTask records.
 */
export class JobStoreService {
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
      prisma.generationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      prisma.generationTask.count({ where }),
    ]);

    return { jobs, total };
  }

  async getJob(jobId: string, userId: string) {
    const job = await prisma.generationTask.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    return job;
  }

  async updateJob(jobId: string, data: GenerationTaskUpdate) {
    const { error, ...rest } = data;
    return prisma.generationTask.update({
      where: { id: jobId },
      data: {
        ...rest,
        error: error ? (error as object) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update only if the task is still queued/running.
   * Returns the updated row, or null if canceled / already terminal.
   */
  async updateJobIfActive(jobId: string, data: GenerationTaskUpdate) {
    const { error, ...rest } = data;
    const result = await prisma.generationTask.updateMany({
      where: { id: jobId, status: { in: ['queued', 'running'] } },
      data: {
        ...rest,
        error: error ? (error as object) : undefined,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) return null;
    return prisma.generationTask.findFirst({ where: { id: jobId } });
  }
}
