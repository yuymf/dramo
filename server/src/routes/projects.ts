import { Hono } from 'hono';
import { ProjectService } from '../services/project.service';
import type { AuthEnv } from '../middleware/auth';

const projects = new Hono<AuthEnv>();
const projectService = new ProjectService();

projects.get('/projects', async (c) => {
  const { page = '1', limit = '20', search } = c.req.query();
  const userId = c.get('user').userId;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  const result = await projectService.listProjects(userId, pageNum, limitNum, search);
  return c.json(result);
});

projects.post('/projects', async (c) => {
  const { name, description } = await c.req.json();
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  if (!name) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '项目名称不能为空', retryable: false }, requestId }, 400);
  }

  const project = await projectService.createProject(userId, { name, description });
  return c.json(project, 201);
});

projects.get('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('user').userId;

  const project = await projectService.getProject(id, userId);
  return c.json(project);
});

projects.put('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const { name, description } = await c.req.json();
  const userId = c.get('user').userId;

  const project = await projectService.updateProject(id, userId, { name, description });
  return c.json(project);
});

projects.patch('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const { name, description } = await c.req.json();
  const userId = c.get('user').userId;

  const project = await projectService.updateProject(id, userId, { name, description });
  return c.json(project);
});

projects.delete('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('user').userId;

  await projectService.deleteProject(id, userId);
  return c.body(null, 204);
});

export { projects };
