import { prisma } from '../lib/db.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import type { AppError } from '../lib/errors.js';

export interface GenerationTaskUpdate {
  status?: string;
  progress?: number;
  workerId?: string;
  resultUrl?: string;
  error?: AppError;
  retryCount?: number;
}

/** DB access for GenerationTask rows. */
export class TaskStoreService {
  async listTasks(params: {
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
      where.status = Array.isArray(params.status) ? { in: params.status } : params.status;
    }

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    const [tasks, total] = await Promise.all([
      prisma.generationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      prisma.generationTask.count({ where }),
    ]);

    return { tasks, total };
  }

  async getTask(taskId: string, userId: string) {
    const task = await prisma.generationTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Task not found');
    }

    return task;
  }

  async updateTask(taskId: string, data: GenerationTaskUpdate) {
    const { error, ...rest } = data;
    return prisma.generationTask.update({
      where: { id: taskId },
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
  async updateTaskIfActive(taskId: string, data: GenerationTaskUpdate) {
    const { error, ...rest } = data;
    const result = await prisma.generationTask.updateMany({
      where: { id: taskId, status: { in: ['queued', 'running'] } },
      data: {
        ...rest,
        error: error ? (error as object) : undefined,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) return null;
    return prisma.generationTask.findFirst({ where: { id: taskId } });
  }
}
