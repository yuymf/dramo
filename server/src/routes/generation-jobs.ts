import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { JobStoreService } from '../services/job-store.service';
import { JobRunnerService, type GenerationKind } from '../services/job-runner.service';
import { logger } from '../lib/logger';
import { AppException, ErrorCode } from '../lib/errors';
import type { AuthEnv } from '../middleware/session';

const generationJobs = new Hono<AuthEnv>();
const store = new JobStoreService();
const runner = new JobRunnerService(store);

function requireUserId(c: { get: (key: 'user') => AuthEnv['Variables']['user'] | undefined }) {
  const user = c.get('user');
  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }
  return user.userId;
}

generationJobs.post('/images/generations', async (c) => {
  const userId = requireUserId(c);
  const body = await c.req.json();

  if (!body?.projectId || typeof body.projectId !== 'string') {
    return c.json({ error: 'projectId is required' }, 400);
  }
  if (body.kind !== 'portrait' && body.kind !== 'location') {
    return c.json({ error: "kind must be 'portrait' or 'location'" }, 400);
  }
  if (!body?.entityId || typeof body.entityId !== 'string') {
    return c.json({ error: 'entityId is required' }, 400);
  }
  if (!body?.prompt || typeof body.prompt !== 'string') {
    return c.json({ error: 'prompt is required' }, 400);
  }
  if (body.aspectRatio !== undefined && typeof body.aspectRatio !== 'string') {
    return c.json({ error: 'aspectRatio must be a string' }, 400);
  }

  try {
    const task = await runner.createJob({
      userId,
      projectId: body.projectId,
      kind: body.kind as GenerationKind,
      entityId: body.entityId,
      prompt: body.prompt,
      aspectRatio: body.aspectRatio,
    });

    return c.json({ ...task, jobId: task.id });
  } catch (error: unknown) {
    if (error instanceof AppException) throw error;
    const message = error instanceof Error ? error.message : 'Failed to create generation job';
    logger.error({ error, body }, 'Failed to create generation job');
    return c.json({ error: message }, 500);
  }
});

generationJobs.get('/jobs', async (c) => {
  const userId = requireUserId(c);
  const query = c.req.query();

  try {
    const statusParams = c.req.queries('status');
    const status = statusParams && statusParams.length > 0 ? statusParams : undefined;

    const result = await store.listJobs({
      userId,
      status,
      projectId: query.projectId,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list jobs';
    logger.error({ error }, 'Failed to list jobs');
    return c.json({ error: message }, 500);
  }
});

generationJobs.get('/jobs/stream', async (c) => {
  const userId = requireUserId(c);
  const projectId = c.req.query('projectId');

  return streamSSE(c, async (stream) => {
    const seen = new Map<string, string>();
    try {
      for (let i = 0; i < 30; i += 1) {
        const { jobs } = await store.listJobs({ userId, projectId, limit: 50 });
        for (const job of jobs) {
          const updatedAt = job.updatedAt instanceof Date ? job.updatedAt.toISOString() : String(job.updatedAt);
          const sig = `${updatedAt}:${job.status}:${job.progress}`;
          if (seen.get(job.id) !== sig) {
            seen.set(job.id, sig);
            await stream.writeSSE({
              event: 'task',
              data: JSON.stringify(job),
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

generationJobs.get('/jobs/:id', async (c) => {
  const userId = requireUserId(c);
  const id = c.req.param('id');

  try {
    const job = await store.getJob(id, userId);
    return c.json(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get job';
    if (message === 'Job not found') {
      return c.json({ error: 'Job not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

generationJobs.post('/jobs/:id/cancel', async (c) => {
  const userId = requireUserId(c);
  const id = c.req.param('id');

  try {
    await runner.cancelJob(id, userId);
    return c.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cancel job';
    if (message === 'Job not found') return c.json({ error: 'Job not found' }, 404);
    if (message === 'Job cannot be canceled') return c.json({ error: message }, 400);
    return c.json({ error: message }, 500);
  }
});

generationJobs.post('/jobs/:id/retry', async (c) => {
  const userId = requireUserId(c);
  const id = c.req.param('id');

  try {
    const newJob = await runner.retryJob(id, userId);
    return c.json({ ...newJob, jobId: newJob.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retry job';
    if (message === 'Job not found') return c.json({ error: 'Job not found' }, 404);
    if (message === 'Only failed jobs can be retried' || message === 'Job is not retryable') {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

export { generationJobs };
