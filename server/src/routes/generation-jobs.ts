import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { GenerationJobService } from '../services/generation-job.service';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';

const generationJobs = new Hono<AuthEnv>();
const jobService = new GenerationJobService();

generationJobs.post('/api/images/generations', async (c) => {
  const userId = c.get('user').userId;
  const body = await c.req.json();

  try {
    const job = await jobService.createJob({
      userId,
      projectId: body.projectId,
      storyboardId: body.storyboardId,
      frameId: body.frameId,
      params: body.params,
    });

    await jobService.updateQueuePositions(userId);

    return c.json({ jobId: job.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create generation job';
    logger.error({ error, body }, 'Failed to create generation job');
    return c.json({ error: message }, 500);
  }
});

generationJobs.get('/api/jobs', async (c) => {
  const userId = c.get('user').userId;
  const query = c.req.query();

  try {
    const status = query.status ? [query.status] : undefined;

    const result = await jobService.listJobs({
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

/**
 * SSE endpoint for real-time job updates.
 * Polls DB for status changes since serverless can't hold EventEmitter state.
 */
generationJobs.get('/api/jobs/stream', async (c) => {
  const userId = c.get('user')?.userId;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return streamSSE(c, async (stream) => {
    let lastCheck = new Date();

    // Poll for changes every 2 seconds, up to ~55 seconds (before Vercel timeout)
    const maxPolls = 27; // ~54 seconds at 2s interval
    let polls = 0;

    while (polls < maxPolls) {
      try {
        // Check for recently updated jobs
        const { jobs } = await jobService.listJobs({
          userId,
          limit: 20,
        });

        for (const job of jobs) {
          const jobUpdated = new Date(job.updatedAt);
          if (jobUpdated > lastCheck) {
            const eventType =
              job.status === 'completed' ? 'job.completed' :
              job.status === 'failed' ? 'job.failed' :
              job.status === 'processing' ? 'job.progress' :
              job.status === 'canceled' ? 'job.canceled' :
              'job.queued';

            await stream.writeSSE({
              event: eventType,
              data: JSON.stringify({
                jobId: job.id,
                status: job.status,
                progress: job.progress,
                resultUrl: job.resultUrl,
                error: job.error,
              }),
            });
          }
        }

        lastCheck = new Date();
      } catch (err) {
        logger.error({ err, userId }, 'Job stream poll error');
      }

      // Heartbeat
      await stream.writeSSE({ event: 'ping', data: '{}' });

      // Wait 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      polls++;
    }

    // Signal timeout for reconnection
    await stream.writeSSE({
      event: 'timeout',
      data: JSON.stringify({ message: 'Reconnect to continue receiving updates' }),
    });
  });
});

generationJobs.get('/api/jobs/:id', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');

  try {
    const job = await jobService.getJob(id, userId);
    return c.json(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get job';
    if (message === 'Job not found') {
      return c.json({ error: 'Job not found' }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

generationJobs.post('/api/jobs/:id/cancel', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');

  try {
    await jobService.cancelJob(id, userId);
    return c.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cancel job';
    if (message === 'Job not found') return c.json({ error: 'Job not found' }, 404);
    if (message === 'Job cannot be canceled') return c.json({ error: message }, 400);
    return c.json({ error: message }, 500);
  }
});

generationJobs.post('/api/jobs/:id/retry', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');

  try {
    const newJob = await jobService.retryJob(id, userId);
    await jobService.updateQueuePositions(userId);
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
