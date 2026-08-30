import { Hono } from 'hono';
import type { ProjectType, ScreenplayFormat } from '@prisma/client';
import { ProjectService } from '../services/project.service';
import type { AuthEnv } from '../middleware/session';
import { AppException, ErrorCode } from '../lib/errors';

const projects = new Hono<AuthEnv>();
const projectService = new ProjectService();

function requireUser(c: { get: (key: 'user') => AuthEnv['Variables']['user'] | undefined }) {
  const user = c.get('user');
  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }
  return user;
}

projects.get('/projects', async (c) => {
  const { page = '1', limit = '20', search } = c.req.query();
  const userId = requireUser(c).userId;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;

  const result = await projectService.listProjects(userId, pageNum, limitNum, search);
  return c.json(result);
});

projects.post('/projects', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, description, type, format } = body as {
    name?: string;
    description?: string;
    type?: ProjectType;
    format?: ScreenplayFormat;
  };
  const userId = requireUser(c).userId;

  if (!name || !String(name).trim()) {
    throw new AppException(ErrorCode.INVALID_INPUT, '项目名称不能为空');
  }

  const project = await projectService.createProject(userId, {
    name: String(name).trim(),
    description,
    type,
    format,
  });
  return c.json(project, 201);
});

projects.get('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const userId = requireUser(c).userId;

  const project = await projectService.getProject(id, userId);
  return c.json(project);
});

projects.patch('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { name, format } = body as { name?: string; format?: ScreenplayFormat };
  const userId = requireUser(c).userId;

  const project = await projectService.updateProject(id, userId, { name, format });
  return c.json(project);
});

projects.delete('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const userId = requireUser(c).userId;

  await projectService.deleteProject(id, userId);
  return c.body(null, 204);
});

export { projects };
