import { prisma } from '../lib/db';
import { AppError, AppException, ErrorCode } from '../lib/errors';

export class TaskService {
  async getTask(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Task not found');
    }

    return task;
  }

  async createTask(data: {
    type: string;
    userId: string;
    input: unknown;
    estimatedSeconds?: number;
  }) {
    const task = await prisma.task.create({
      data: {
        type: data.type,
        userId: data.userId,
        status: 'queued',
        progress: 0,
        input: data.input as any,
        estimatedSeconds: data.estimatedSeconds,
      },
    });

    return task;
  }

  async updateTask(
    taskId: string,
    data: {
      status?: string;
      progress?: number;
      result?: unknown;
      error?: AppError;
    }
  ) {
    const { result, error, ...rest } = data;
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...rest,
        result: result !== undefined ? (result as any) : undefined,
        error: error ? (error as any) : undefined,
        updatedAt: new Date(),
      },
    });

    return task;
  }
}
