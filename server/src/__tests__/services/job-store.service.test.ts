import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {
    generationTask: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/db';
import { JobStoreService } from '../../services/job-store.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    userId: 'user-1',
    projectId: 'proj-1',
    kind: 'portrait',
    entityType: 'character',
    entityId: 'char-1',
    prompt: 'a portrait',
    aspectRatio: '1:1',
    status: 'queued',
    progress: 0,
    workerId: null,
    resultUrl: null,
    error: null,
    retryCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('JobStoreService', () => {
  let service: JobStoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobStoreService();
  });

  describe('listJobs', () => {
    it('should return jobs and total', async () => {
      const task = makeTask();
      (mockPrisma.generationTask.findMany as jest.MockedFunction<typeof mockPrisma.generationTask.findMany>)
        .mockResolvedValue([task as never]);
      (mockPrisma.generationTask.count as jest.MockedFunction<typeof mockPrisma.generationTask.count>)
        .mockResolvedValue(1);

      const result = await service.listJobs({ userId: 'user-1' });

      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status string', async () => {
      (mockPrisma.generationTask.findMany as jest.MockedFunction<typeof mockPrisma.generationTask.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationTask.count as jest.MockedFunction<typeof mockPrisma.generationTask.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', status: 'queued' });

      expect(mockPrisma.generationTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', status: 'queued' } })
      );
    });

    it('should filter by status array', async () => {
      (mockPrisma.generationTask.findMany as jest.MockedFunction<typeof mockPrisma.generationTask.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationTask.count as jest.MockedFunction<typeof mockPrisma.generationTask.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', status: ['queued', 'running'] });

      expect(mockPrisma.generationTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: { in: ['queued', 'running'] } },
        })
      );
    });

    it('should filter by projectId', async () => {
      (mockPrisma.generationTask.findMany as jest.MockedFunction<typeof mockPrisma.generationTask.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationTask.count as jest.MockedFunction<typeof mockPrisma.generationTask.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', projectId: 'proj-1' });

      expect(mockPrisma.generationTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', projectId: 'proj-1' },
        })
      );
    });

    it('should apply limit and offset', async () => {
      (mockPrisma.generationTask.findMany as jest.MockedFunction<typeof mockPrisma.generationTask.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationTask.count as jest.MockedFunction<typeof mockPrisma.generationTask.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', limit: 10, offset: 20 });

      expect(mockPrisma.generationTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      );
    });

    it('should default limit to 50 and offset to 0', async () => {
      (mockPrisma.generationTask.findMany as jest.MockedFunction<typeof mockPrisma.generationTask.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationTask.count as jest.MockedFunction<typeof mockPrisma.generationTask.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1' });

      expect(mockPrisma.generationTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 })
      );
    });
  });

  describe('getJob', () => {
    it('should return job when found', async () => {
      const task = makeTask();
      (mockPrisma.generationTask.findFirst as jest.MockedFunction<typeof mockPrisma.generationTask.findFirst>)
        .mockResolvedValue(task as never);

      const result = await service.getJob('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('should throw when job not found', async () => {
      (mockPrisma.generationTask.findFirst as jest.MockedFunction<typeof mockPrisma.generationTask.findFirst>)
        .mockResolvedValue(null);

      await expect(service.getJob('nonexistent', 'user-1')).rejects.toThrow('Job not found');
    });

    it('should query by both jobId and userId', async () => {
      (mockPrisma.generationTask.findFirst as jest.MockedFunction<typeof mockPrisma.generationTask.findFirst>)
        .mockResolvedValue(makeTask() as never);

      await service.getJob('task-1', 'user-1');

      expect(mockPrisma.generationTask.findFirst).toHaveBeenCalledWith({
        where: { id: 'task-1', userId: 'user-1' },
      });
    });
  });

  describe('updateJob', () => {
    it('should update job status', async () => {
      const updated = makeTask({ status: 'running' });
      (mockPrisma.generationTask.update as jest.MockedFunction<typeof mockPrisma.generationTask.update>)
        .mockResolvedValue(updated as never);

      await service.updateJob('task-1', { status: 'running' });

      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({ status: 'running' }),
      });
    });

    it('should update error field', async () => {
      const updated = makeTask({ status: 'failed' });
      (mockPrisma.generationTask.update as jest.MockedFunction<typeof mockPrisma.generationTask.update>)
        .mockResolvedValue(updated as never);

      await service.updateJob('task-1', {
        status: 'failed',
        error: { code: 'ERR', message: 'Failed', retryable: true },
      });

      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'failed',
          error: { code: 'ERR', message: 'Failed', retryable: true },
        }),
      });
    });

    it('should update only active jobs via updateJobIfActive', async () => {
      (mockPrisma.generationTask.updateMany as jest.MockedFunction<typeof mockPrisma.generationTask.updateMany>)
        .mockResolvedValue({ count: 1 } as never);
      (mockPrisma.generationTask.findFirst as jest.MockedFunction<typeof mockPrisma.generationTask.findFirst>)
        .mockResolvedValue(makeTask({ status: 'running' }) as never);

      const result = await service.updateJobIfActive('task-1', { status: 'running', progress: 10 });

      expect(mockPrisma.generationTask.updateMany).toHaveBeenCalledWith({
        where: { id: 'task-1', status: { in: ['queued', 'running'] } },
        data: expect.objectContaining({ status: 'running', progress: 10 }),
      });
      expect(result?.status).toBe('running');
    });

    it('should return null from updateJobIfActive when job is no longer active', async () => {
      (mockPrisma.generationTask.updateMany as jest.MockedFunction<typeof mockPrisma.generationTask.updateMany>)
        .mockResolvedValue({ count: 0 } as never);

      const result = await service.updateJobIfActive('task-1', { status: 'completed' });

      expect(result).toBeNull();
      expect(mockPrisma.generationTask.findFirst).not.toHaveBeenCalled();
    });

    it('should set updatedAt timestamp', async () => {
      (mockPrisma.generationTask.update as jest.MockedFunction<typeof mockPrisma.generationTask.update>)
        .mockResolvedValue(makeTask() as never);

      await service.updateJob('task-1', { progress: 50 });

      const callArg = (mockPrisma.generationTask.update as jest.MockedFunction<typeof mockPrisma.generationTask.update>).mock.calls[0][0];
      expect(callArg.data.updatedAt).toBeInstanceOf(Date);
    });
  });
});
