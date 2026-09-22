import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {
    generationTask: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    character: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    asset: {
      create: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/db.js';
import { TaskRunnerService } from '../../services/task-runner.service.js';
import { TaskStoreService } from '../../services/task-store.service.js';
import { NO_SD_WORKER_MESSAGE, type SdPoolService } from '../../services/sd-pool.service.js';
import type { StorageService } from '../../services/storage.service.js';

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

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('TaskRunnerService', () => {
  let mockStore: jest.Mocked<TaskStoreService>;
  let mockPool: jest.Mocked<SdPoolService>;
  let mockStorage: jest.Mocked<StorageService>;
  let service: TaskRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStore = {
      listTasks: jest.fn(),
      getTask: jest.fn(),
      updateTask: jest.fn(),
      updateTaskIfActive: jest.fn(),
    } as unknown as jest.Mocked<TaskStoreService>;

    mockPool = {
      pickWorker: jest.fn(),
      txt2img: jest.fn(),
      release: jest.fn(),
    } as unknown as jest.Mocked<SdPoolService>;

    mockStorage = {
      uploadImageFromBase64: jest.fn(),
      publicApiUrl: jest.fn((projectId: string, filename: string) => `/api/files/projects/${projectId}/${filename}`),
    } as unknown as jest.Mocked<StorageService>;

    (mockPrisma.character.findFirst as jest.MockedFunction<typeof mockPrisma.character.findFirst>)
      .mockResolvedValue({ id: 'char-1', projectId: 'proj-1', images: [] } as never);

    service = new TaskRunnerService(mockStore, mockPool, mockStorage);
  });

  describe('createTask', () => {
    it('creates a GenerationTask and returns it', async () => {
      const task = makeTask();
      (mockPrisma.generationTask.create as jest.MockedFunction<typeof mockPrisma.generationTask.create>)
        .mockResolvedValue(task as never);
      mockPool.pickWorker.mockResolvedValue(null);
      mockStore.updateTaskIfActive.mockResolvedValue(task as never);

      const result = await service.createTask({
        userId: 'user-1',
        projectId: 'proj-1',
        kind: 'portrait',
        entityId: 'char-1',
        prompt: 'a portrait',
      });

      expect(result).toEqual(task);
      expect(mockPrisma.generationTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          projectId: 'proj-1',
          kind: 'portrait',
          entityType: 'character',
          entityId: 'char-1',
          prompt: 'a portrait',
          status: 'queued',
          progress: 0,
        }),
      });
    });

    it('fails with a Chinese no-worker message when the pool is empty', async () => {
      const task = makeTask();
      (mockPrisma.generationTask.create as jest.MockedFunction<typeof mockPrisma.generationTask.create>)
        .mockResolvedValue(task as never);
      mockPool.pickWorker.mockResolvedValue(null);
      mockStore.updateTaskIfActive.mockResolvedValue(task as never);

      await service.createTask({
        userId: 'user-1',
        projectId: 'proj-1',
        kind: 'portrait',
        entityId: 'char-1',
        prompt: 'a portrait',
      });
      await flush();

      expect(mockStore.updateTaskIfActive).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({
            code: 'NO_SD_WORKER',
            message: NO_SD_WORKER_MESSAGE,
          }),
        })
      );
    });

    it('writes uploads, Asset, and Character.images on success', async () => {
      const task = makeTask();
      (mockPrisma.generationTask.create as jest.MockedFunction<typeof mockPrisma.generationTask.create>)
        .mockResolvedValue(task as never);
      mockPool.pickWorker.mockResolvedValue({
        id: 'sd-1',
        baseUrl: 'http://127.0.0.1:7860',
        weight: 1,
        capabilities: ['txt2img'],
        queue: 1,
        failCount: 0,
        healthy: true,
      });
      mockPool.txt2img.mockResolvedValue('iVBORw0KGgo=');
      mockStorage.uploadImageFromBase64.mockResolvedValue({
        url: 'http://localhost/uploads/projects/proj-1/img.png',
        path: 'projects/proj-1/img.png',
      });
      mockStore.updateTaskIfActive.mockResolvedValue(task as never);
      (mockPrisma.asset.create as jest.MockedFunction<typeof mockPrisma.asset.create>)
        .mockResolvedValue({ id: 'asset-1' } as never);
      (mockPrisma.character.update as jest.MockedFunction<typeof mockPrisma.character.update>)
        .mockResolvedValue({ id: 'char-1' } as never);

      await service.createTask({
        userId: 'user-1',
        projectId: 'proj-1',
        kind: 'portrait',
        entityId: 'char-1',
        prompt: 'a portrait',
        aspectRatio: '1:1',
      });
      await flush();

      expect(mockPool.txt2img).toHaveBeenCalled();
      expect(mockStorage.uploadImageFromBase64).toHaveBeenCalled();
      expect(mockPrisma.asset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          kind: 'portrait',
          entityType: 'character',
          entityId: 'char-1',
          url: '/api/files/projects/proj-1/img.png',
          taskId: 'task-1',
        }),
      });
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        data: { images: [{ url: '/api/files/projects/proj-1/img.png' }] },
      });
      expect(mockStore.updateTaskIfActive).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'completed',
          progress: 100,
          resultUrl: '/api/files/projects/proj-1/img.png',
        })
      );
      expect(mockPool.release).toHaveBeenCalledWith('sd-1');
    });

    it('maps a connection error from txt2img to the Chinese no-worker message', async () => {
      const task = makeTask();
      (mockPrisma.generationTask.create as jest.MockedFunction<typeof mockPrisma.generationTask.create>)
        .mockResolvedValue(task as never);
      mockPool.pickWorker.mockResolvedValue({
        id: 'sd-1',
        baseUrl: 'http://127.0.0.1:7860',
        weight: 1,
        capabilities: ['txt2img'],
        queue: 1,
        failCount: 0,
        healthy: true,
      });
      mockPool.txt2img.mockRejectedValue(new Error('fetch failed'));
      mockStore.updateTaskIfActive.mockResolvedValue(task as never);

      await service.createTask({
        userId: 'user-1',
        projectId: 'proj-1',
        kind: 'portrait',
        entityId: 'char-1',
        prompt: 'a portrait',
      });
      await flush();

      expect(mockStore.updateTaskIfActive).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({
            code: 'NO_SD_WORKER',
            message: NO_SD_WORKER_MESSAGE,
          }),
        })
      );
      expect(mockPool.release).toHaveBeenCalledWith('sd-1');
    });
  });

  describe('runTxt2Img', () => {
    it('creates a cinema_frame task and returns the stored url', async () => {
      const task = makeTask({ id: 'task-c', kind: 'cinema_frame', entityType: 'reel', entityId: 'reel-1' });
      (mockPrisma.generationTask.create as jest.MockedFunction<typeof mockPrisma.generationTask.create>)
        .mockResolvedValue(task as never);
      mockPool.pickWorker.mockResolvedValue({
        id: 'sd-1',
        baseUrl: 'http://127.0.0.1:7860',
        weight: 1,
        capabilities: ['txt2img'],
        queue: 0,
        failCount: 0,
        healthy: true,
      });
      mockPool.txt2img.mockResolvedValue('iVBORw0KGgo=');
      mockStorage.uploadImageFromBase64.mockResolvedValue({
        url: 'http://localhost/uploads/projects/proj-1/frame.png',
        path: 'projects/proj-1/frame.png',
      });
      mockStore.updateTaskIfActive.mockResolvedValue(task as never);
      (mockPrisma.asset.create as jest.MockedFunction<typeof mockPrisma.asset.create>)
        .mockResolvedValue({ id: 'asset-1' } as never);

      const result = await service.runTxt2Img({
        userId: 'user-1',
        projectId: 'proj-1',
        kind: 'cinema_frame',
        entityType: 'reel',
        entityId: 'reel-1',
        prompt: 'wide shot',
        aspectRatio: '2.39:1',
        stickyKey: 'reel-1',
      });

      expect(result).toEqual({ taskId: 'task-c', url: '/api/files/projects/proj-1/frame.png' });
      expect(mockPrisma.generationTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'cinema_frame',
          entityType: 'reel',
          entityId: 'reel-1',
        }),
      });
      expect(mockPrisma.character.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelTask', () => {
    it('should cancel a queued task', async () => {
      const task = makeTask({ status: 'queued' });
      const canceled = makeTask({ status: 'canceled' });
      mockStore.getTask.mockResolvedValue(task as never);
      mockStore.updateTask.mockResolvedValue(canceled as never);

      const result = await service.cancelTask('task-1', 'user-1');

      expect(mockStore.updateTask).toHaveBeenCalledWith('task-1', { status: 'canceled' });
      expect(result).toEqual(canceled);
    });

    it('should return already canceled task without re-canceling', async () => {
      const task = makeTask({ status: 'canceled' });
      mockStore.getTask.mockResolvedValue(task as never);

      const result = await service.cancelTask('task-1', 'user-1');

      expect(mockStore.updateTask).not.toHaveBeenCalled();
      expect(result).toEqual(task);
    });

    it('should throw when trying to cancel a completed task', async () => {
      mockStore.getTask.mockResolvedValue(makeTask({ status: 'completed' }) as never);
      await expect(service.cancelTask('task-1', 'user-1')).rejects.toMatchObject({
        message: 'Task cannot be canceled',
      });
    });

    it('should throw when trying to cancel a failed task', async () => {
      mockStore.getTask.mockResolvedValue(makeTask({ status: 'failed' }) as never);
      await expect(service.cancelTask('task-1', 'user-1')).rejects.toMatchObject({
        message: 'Task cannot be canceled',
      });
    });
  });

  describe('retryTask', () => {
    it('should retry a failed task', async () => {
      const failed = makeTask({ status: 'failed', error: { retryable: true } });
      const created = makeTask({ id: 'task-2', status: 'queued' });
      mockStore.getTask.mockResolvedValue(failed as never);
      (mockPrisma.generationTask.create as jest.MockedFunction<typeof mockPrisma.generationTask.create>)
        .mockResolvedValue(created as never);
      mockPool.pickWorker.mockResolvedValue(null);
      mockStore.updateTaskIfActive.mockResolvedValue(created as never);

      const result = await service.retryTask('task-1', 'user-1');

      expect(result).toEqual(created);
    });

    it('should throw when retrying non-failed task', async () => {
      mockStore.getTask.mockResolvedValue(makeTask({ status: 'running' }) as never);
      await expect(service.retryTask('task-1', 'user-1')).rejects.toMatchObject({
        message: 'Only failed tasks can be retried',
      });
    });

    it('should throw when task is not retryable', async () => {
      mockStore.getTask.mockResolvedValue(makeTask({ status: 'failed', error: { retryable: false } }) as never);
      await expect(service.retryTask('task-1', 'user-1')).rejects.toMatchObject({
        message: 'Task is not retryable',
      });
    });
  });
});
