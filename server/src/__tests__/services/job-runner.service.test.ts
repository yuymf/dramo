import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock prisma before importing
jest.mock('../../lib/db', () => ({
  prisma: {
    generationJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock agentos-client
jest.mock('../../lib/agentos-client', () => ({
  runImageGeneration: jest.fn(),
}));

// Mock LLMConfigService
jest.mock('../../services/llm-config.service', () => ({
  LLMConfigService: jest.fn().mockImplementation(() => ({
    getLLMHeaders: (jest.fn() as jest.MockedFunction<() => Promise<Record<string, string>>>).mockResolvedValue({ 'X-LLM-Api-Key': 'sk-test' }),
  })),
}));

import { prisma } from '../../lib/db';
import { runImageGeneration } from '../../lib/agentos-client';
import { JobRunnerService } from '../../services/job-runner.service';
import { JobStoreService } from '../../services/job-store.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRunImageGeneration = runImageGeneration as jest.MockedFunction<typeof runImageGeneration>;

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    userId: 'user-1',
    projectId: 'proj-1',
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

describe('JobRunnerService', () => {
  let mockStore: jest.Mocked<JobStoreService>;
  let service: JobRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStore = {
      listJobs: jest.fn(),
      getJob: jest.fn(),
      updateJob: jest.fn(),
      updateJobIfActive: jest.fn(),
      updateQueuePositions: jest.fn(),
    } as unknown as jest.Mocked<JobStoreService>;

    service = new JobRunnerService(mockStore);
  });

  describe('createJob', () => {
    it('should create a job and return it', async () => {
      const job = makeJob();
      (mockPrisma.generationJob.create as jest.MockedFunction<typeof mockPrisma.generationJob.create>)
        .mockResolvedValue(job as any);
      mockStore.updateJob.mockResolvedValue(job as any);
      mockStore.updateJobIfActive.mockResolvedValue(job as any);
      mockRunImageGeneration.mockResolvedValue({ images: [{ url: 'https://example.com/img.png' }] } as any);

      const result = await service.createJob({
        userId: 'user-1',
        projectId: 'proj-1',
        params: { name: 'test', description: 'test image' },
      });

      expect(result).toEqual(job);
      expect(mockPrisma.generationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          projectId: 'proj-1',
          status: 'queued',
          progress: 0,
        }),
      });
    });

    it('should start async execution in background', async () => {
      const job = makeJob();
      (mockPrisma.generationJob.create as jest.MockedFunction<typeof mockPrisma.generationJob.create>)
        .mockResolvedValue(job as any);
      mockStore.updateJob.mockResolvedValue(job as any);
      mockStore.updateJobIfActive.mockResolvedValue(job as any);
      mockRunImageGeneration.mockResolvedValue({ images: [{ url: 'https://example.com/img.png' }] } as any);

      await service.createJob({
        userId: 'user-1',
        projectId: 'proj-1',
        params: { name: 'test', description: 'test image' },
      });

      // Give the fire-and-forget a tick to start
      await new Promise((resolve) => setImmediate(resolve));

      // Should have started execution
      expect(mockStore.updateJobIfActive).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'running' }));
    });
  });

  describe('cancelJob', () => {
    it('should cancel a queued job', async () => {
      const job = makeJob({ status: 'queued' });
      const canceled = makeJob({ status: 'canceled' });
      mockStore.getJob.mockResolvedValue(job as any);
      mockStore.updateJob.mockResolvedValue(canceled as any);

      const result = await service.cancelJob('job-1', 'user-1');

      expect(mockStore.updateJob).toHaveBeenCalledWith('job-1', { status: 'canceled' });
      expect(result).toEqual(canceled);
    });

    it('should return already canceled job without re-canceling', async () => {
      const job = makeJob({ status: 'canceled' });
      mockStore.getJob.mockResolvedValue(job as any);

      const result = await service.cancelJob('job-1', 'user-1');

      expect(mockStore.updateJob).not.toHaveBeenCalled();
      expect(result).toEqual(job);
    });

    it('should throw when trying to cancel succeeded job', async () => {
      const job = makeJob({ status: 'succeeded' });
      mockStore.getJob.mockResolvedValue(job as any);

      await expect(service.cancelJob('job-1', 'user-1')).rejects.toThrow('Job cannot be canceled');
    });

    it('should throw when trying to cancel a failed job', async () => {
      const job = makeJob({ status: 'failed' });
      mockStore.getJob.mockResolvedValue(job as any);

      await expect(service.cancelJob('job-1', 'user-1')).rejects.toThrow('Job cannot be canceled');
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job', async () => {
      const failedJob = makeJob({ status: 'failed', error: { retryable: true } });
      const newJob = makeJob({ id: 'job-2', status: 'queued' });
      mockStore.getJob.mockResolvedValue(failedJob as any);
      (mockPrisma.generationJob.create as jest.MockedFunction<typeof mockPrisma.generationJob.create>)
        .mockResolvedValue(newJob as any);
      mockStore.updateJob.mockResolvedValue(newJob as any);
      mockRunImageGeneration.mockResolvedValue({ images: [{ url: 'https://example.com/img.png' }] } as any);

      const result = await service.retryJob('job-1', 'user-1');

      expect(result).toEqual(newJob);
    });

    it('should throw when retrying non-failed job', async () => {
      const job = makeJob({ status: 'running' });
      mockStore.getJob.mockResolvedValue(job as any);

      await expect(service.retryJob('job-1', 'user-1')).rejects.toThrow('Only failed jobs can be retried');
    });

    it('should throw when job is not retryable', async () => {
      const job = makeJob({ status: 'failed', error: { retryable: false } });
      mockStore.getJob.mockResolvedValue(job as any);

      await expect(service.retryJob('job-1', 'user-1')).rejects.toThrow('Job is not retryable');
    });

    it('should not retry storyboard import jobs', async () => {
      const job = makeJob({ status: 'failed', type: 'storyboard_import', error: { retryable: true } });
      mockStore.getJob.mockResolvedValue(job as any);

      await expect(service.retryJob('job-1', 'user-1')).rejects.toThrow('Job is not retryable');
    });

    it('should retry job with null error (retryable by default)', async () => {
      const failedJob = makeJob({ status: 'failed', error: null });
      const newJob = makeJob({ id: 'job-2', status: 'queued' });
      mockStore.getJob.mockResolvedValue(failedJob as any);
      (mockPrisma.generationJob.create as jest.MockedFunction<typeof mockPrisma.generationJob.create>)
        .mockResolvedValue(newJob as any);
      mockStore.updateJob.mockResolvedValue(newJob as any);
      mockRunImageGeneration.mockResolvedValue({ images: [{ url: 'https://example.com/img.png' }] } as any);

      const result = await service.retryJob('job-1', 'user-1');

      expect(result).toEqual(newJob);
    });
  });
});
