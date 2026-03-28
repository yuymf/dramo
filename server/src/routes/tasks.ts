import { Hono } from 'hono';
import { TaskService } from '../services/task.service';
import type { AuthEnv } from '../middleware/auth';

const tasks = new Hono<AuthEnv>();
const taskService = new TaskService();

tasks.get('/api/tasks/:taskId', async (c) => {
  const taskId = c.req.param('taskId');
  const userId = c.get('user').userId;

  const task = await taskService.getTask(taskId, userId);

  return c.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    estimatedSeconds: task.estimatedSeconds,
  });
});

export { tasks };
