import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock prisma before importing
jest.mock('../../lib/db', () => ({
  prisma: {
    generationJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/db';
import { JobStoreService } from '../../services/job-store.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    userId: 'user-1',
    projectId: 'proj-1',
    storyboardId: null,
    frameId: null,
    status: 'queued',
    progress: 0,
    queuePosition: 1,
    resultUrl: null,
    error: null,
    params: { name: 'test', description: 'test image' },
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
      const job = makeJob();
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([job as any]);
      (mockPrisma.generationJob.count as jest.MockedFunction<typeof mockPrisma.generationJob.count>)
        .mockResolvedValue(1);

      const result = await service.listJobs({ userId: 'user-1' });

      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status string', async () => {
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationJob.count as jest.MockedFunction<typeof mockPrisma.generationJob.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', status: 'queued' });

      expect(mockPrisma.generationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', status: 'queued' } })
      );
    });

    it('should filter by status array', async () => {
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationJob.count as jest.MockedFunction<typeof mockPrisma.generationJob.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', status: ['queued', 'processing'] });

      expect(mockPrisma.generationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: { in: ['queued', 'processing'] } },
        })
      );
    });

    it('should filter by projectId', async () => {
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationJob.count as jest.MockedFunction<typeof mockPrisma.generationJob.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', projectId: 'proj-1' });

      expect(mockPrisma.generationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', projectId: 'proj-1' },
        })
      );
    });

    it('should apply limit and offset', async () => {
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationJob.count as jest.MockedFunction<typeof mockPrisma.generationJob.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1', limit: 10, offset: 20 });

      expect(mockPrisma.generationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      );
    });

    it('should default limit to 50 and offset to 0', async () => {
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([]);
      (mockPrisma.generationJob.count as jest.MockedFunction<typeof mockPrisma.generationJob.count>)
        .mockResolvedValue(0);

      await service.listJobs({ userId: 'user-1' });

      expect(mockPrisma.generationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 })
      );
    });
  });

  describe('getJob', () => {
    it('should return job when found', async () => {
      const job = makeJob();
      (mockPrisma.generationJob.findFirst as jest.MockedFunction<typeof mockPrisma.generationJob.findFirst>)
        .mockResolvedValue(job as any);

      const result = await service.getJob('job-1', 'user-1');

      expect(result).toEqual(job);
    });

    it('should throw when job not found', async () => {
      (mockPrisma.generationJob.findFirst as jest.MockedFunction<typeof mockPrisma.generationJob.findFirst>)
        .mockResolvedValue(null);

      await expect(service.getJob('nonexistent', 'user-1')).rejects.toThrow('Job not found');
    });

    it('should query by both jobId and userId', async () => {
      (mockPrisma.generationJob.findFirst as jest.MockedFunction<typeof mockPrisma.generationJob.findFirst>)
        .mockResolvedValue(makeJob() as any);

      await service.getJob('job-1', 'user-1');

      expect(mockPrisma.generationJob.findFirst).toHaveBeenCalledWith({
        where: { id: 'job-1', userId: 'user-1' },
      });
    });
  });

  describe('updateJob', () => {
    it('should update job status', async () => {
      const updated = makeJob({ status: 'processing' });
      (mockPrisma.generationJob.update as jest.MockedFunction<typeof mockPrisma.generationJob.update>)
        .mockResolvedValue(updated as any);

      await service.updateJob('job-1', { status: 'processing' });

      expect(mockPrisma.generationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'processing' }),
      });
    });

    it('should update error field', async () => {
      const updated = makeJob({ status: 'failed' });
      (mockPrisma.generationJob.update as jest.MockedFunction<typeof mockPrisma.generationJob.update>)
        .mockResolvedValue(updated as any);

      await service.updateJob('job-1', {
        status: 'failed',
        error: { code: 'ERR', message: 'Failed', retryable: true } as any,
      });

      expect(mockPrisma.generationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'failed',
          error: { code: 'ERR', message: 'Failed', retryable: true },
        }),
      });
    });

    it('should set updatedAt timestamp', async () => {
      (mockPrisma.generationJob.update as jest.MockedFunction<typeof mockPrisma.generationJob.update>)
        .mockResolvedValue(makeJob() as any);

      await service.updateJob('job-1', { progress: 50 });

      const callArg = (mockPrisma.generationJob.update as jest.MockedFunction<typeof mockPrisma.generationJob.update>).mock.calls[0][0];
      expect(callArg.data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateQueuePositions', () => {
    it('should update queue positions for queued jobs', async () => {
      const jobs = [
        makeJob({ id: 'job-1', createdAt: new Date('2024-01-01') }),
        makeJob({ id: 'job-2', createdAt: new Date('2024-01-02') }),
      ];
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue(jobs as any);
      (mockPrisma.generationJob.update as jest.MockedFunction<typeof mockPrisma.generationJob.update>)
        .mockResolvedValue(jobs[0] as any);

      await service.updateQueuePositions('user-1');

      expect(mockPrisma.generationJob.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'queued' },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockPrisma.generationJob.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty queue', async () => {
      (mockPrisma.generationJob.findMany as jest.MockedFunction<typeof mockPrisma.generationJob.findMany>)
        .mockResolvedValue([]);

      await service.updateQueuePositions('user-1');

      expect(mockPrisma.generationJob.update).not.toHaveBeenCalled();
    });
  });
});
