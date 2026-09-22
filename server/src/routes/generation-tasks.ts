import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { TaskStoreService } from '../services/task-store.service.js';
import { TaskRunnerService, type GenerationKind } from '../services/task-runner.service.js';
import { logger } from '../lib/logger.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import type { AuthEnv } from '../middleware/session.js';
import { asObject, readJson, requireUser } from './helpers.js';

const generationTasks = new Hono<AuthEnv>();
const store = new TaskStoreService();
const runner = new TaskRunnerService(store);

generationTasks.post('/images/generations', async (c) => {
  const userId = requireUser(c).userId;
  const body = asObject(await readJson(c));

  if (typeof body.projectId !== 'string' || !body.projectId) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'projectId is required');
  }
  if (body.kind !== 'portrait' && body.kind !== 'location') {
    throw new AppException(ErrorCode.INVALID_INPUT, "kind must be 'portrait' or 'location'");
  }
  if (typeof body.entityId !== 'string' || !body.entityId) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'entityId is required');
  }
  if (typeof body.prompt !== 'string' || !body.prompt) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'prompt is required');
  }
  if (body.aspectRatio !== undefined && typeof body.aspectRatio !== 'string') {
    throw new AppException(ErrorCode.INVALID_INPUT, 'aspectRatio must be a string');
  }

  return c.json(
    await runner.createTask({
      userId,
      projectId: body.projectId,
      kind: body.kind as GenerationKind,
      entityId: body.entityId,
      prompt: body.prompt,
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
    })
  );
});

generationTasks.get('/tasks', async (c) => {
  const userId = requireUser(c).userId;
  const query = c.req.query();
  const statusParams = c.req.queries('status');
  const status = statusParams && statusParams.length > 0 ? statusParams : undefined;

  return c.json(
    await store.listTasks({
      userId,
      status,
      projectId: query.projectId,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    })
  );
});

generationTasks.get('/tasks/stream', async (c) => {
  const userId = requireUser(c).userId;
  const projectId = c.req.query('projectId');

  return streamSSE(c, async (stream) => {
    const seen = new Map<string, string>();
    try {
      for (let i = 0; i < 30; i += 1) {
        const { tasks } = await store.listTasks({ userId, projectId, limit: 50 });
        for (const task of tasks) {
          const updatedAt = task.updatedAt instanceof Date ? task.updatedAt.toISOString() : String(task.updatedAt);
          const sig = `${updatedAt}:${task.status}:${task.progress}`;
          if (seen.get(task.id) !== sig) {
            seen.set(task.id, sig);
            await stream.writeSSE({
              event: 'task',
              data: JSON.stringify(task),
            });
          }
        }
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ ts: Date.now() }),
        });
        await stream.sleep(2000);
      }
    } catch (error: unknown) {
      logger.warn({ error }, 'GenerationTask SSE stream ended');
    }
  });
});

generationTasks.get('/tasks/:id', async (c) => {
  return c.json(await store.getTask(c.req.param('id'), requireUser(c).userId));
});

generationTasks.post('/tasks/:id/cancel', async (c) => {
  await runner.cancelTask(c.req.param('id'), requireUser(c).userId);
  return c.json({ success: true });
});

generationTasks.post('/tasks/:id/retry', async (c) => {
  return c.json(await runner.retryTask(c.req.param('id'), requireUser(c).userId));
});

export { generationTasks };
