import { Hono } from 'hono';
import { JobStoreService } from '../services/job-store.service';
import { JobRunnerService } from '../services/job-runner.service';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/default-user';

const generationJobs = new Hono<AuthEnv>();
const store = new JobStoreService();
const runner = new JobRunnerService(store);

generationJobs.post('/images/generations', async (c) => {
  const userId = c.get('user').userId;
  const body = await c.req.json();

  if (!body?.projectId || typeof body.projectId !== 'string') {
    return c.json({ error: 'projectId is required' }, 400);
  }
  if (!body?.params?.description || typeof body.params.description !== 'string') {
    return c.json({ error: 'params.description is required' }, 400);
  }

  try {
    const job = await runner.createJob({
      userId,
      projectId: body.projectId,
      storyboardId: body.storyboardId,
      frameId: body.frameId,
      params: body.params,
    });

    await store.updateQueuePositions(userId);

    return c.json({ jobId: job.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create generation job';
    logger.error({ error, body }, 'Failed to create generation job');
    return c.json({ error: message }, 500);
  }
});

generationJobs.get('/jobs', async (c) => {
  const userId = c.get('user').userId;
  const query = c.req.query();

  try {
    const statusParams = c.req.queries('status');
    const status = statusParams && statusParams.length > 0 ? statusParams : undefined;

    const result = await store.listJobs({
      userId,
      status,
      projectId: query.projectId,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    });

    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list jobs';
    logger.error({ error }, 'Failed to list jobs');
    return c.json({ error: message }, 500);
  }
});

generationJobs.get('/jobs/:id', async (c) => {
  const userId = c.get('user').userId;
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
  const userId = c.get('user').userId;
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
  const userId = c.get('user').userId;
  const id = c.req.param('id');

  try {
    const newJob = await runner.retryJob(id, userId);
    await store.updateQueuePositions(userId);
    return c.json({ jobId: newJob.id });
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
