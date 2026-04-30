import { Hono } from 'hono';
import { RelationService } from '../services/relation.service';
import { ProjectService } from '../services/project.service';
import type { AuthEnv } from '../middleware/auth';

const relations = new Hono<AuthEnv>();
const relationService = new RelationService();
const projectService = new ProjectService();

relations.get('/projects/:projectId/characters/relations', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  try {
    await projectService.getProject(projectId, userId);
    const result = await relationService.listRelations(projectId);
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取关系列表失败';
    return c.json({ success: false, error: { code: 'LIST_FAILED', message, retryable: true }, requestId }, 500);
  }
});

relations.post('/projects/:projectId/characters/relations', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const { sourceId, targetId, type, weight, notes } = await c.req.json();

  try {
    await projectService.getProject(projectId, userId);
  } catch {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '项目不存在或无权访问', retryable: false }, requestId }, 404);
  }

  if (!sourceId || !targetId) {
    return c.json({ success: false, error: { code: 'INVALID_INPUT', message: 'sourceId 和 targetId 不能为空', retryable: false }, requestId }, 400);
  }

  try {
    const result = await relationService.createRelation(projectId, { sourceId, targetId, type, weight, notes });
    return c.json(result, 201);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
      return c.json({ success: false, error: { code: 'DUPLICATE_RELATION', message: '该关系已存在', retryable: false }, requestId }, 409);
    }
    return c.json({ success: false, error: { code: 'CREATE_FAILED', message: err.message || '创建关系失败', retryable: true }, requestId }, 500);
  }
});

relations.patch('/projects/:projectId/characters/relations/:relationId', async (c) => {
  const projectId = c.req.param('projectId');
  const relationId = c.req.param('relationId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const { type, weight, notes } = await c.req.json();

  try {
    await projectService.getProject(projectId, userId);
    const result = await relationService.updateRelation(relationId, projectId, { type, weight, notes });
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新关系失败';
    if (message === 'Relation not found') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: '关系不存在', retryable: false }, requestId }, 404);
    }
    return c.json({ success: false, error: { code: 'UPDATE_FAILED', message, retryable: true }, requestId }, 500);
  }
});

relations.delete('/projects/:projectId/characters/relations/:relationId', async (c) => {
  const projectId = c.req.param('projectId');
  const relationId = c.req.param('relationId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  try {
    await projectService.getProject(projectId, userId);
    const result = await relationService.deleteRelation(relationId, projectId);
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除关系失败';
    if (message === 'Relation not found') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: '关系不存在', retryable: false }, requestId }, 404);
    }
    return c.json({ success: false, error: { code: 'DELETE_FAILED', message, retryable: true }, requestId }, 500);
  }
});

relations.post('/projects/:projectId/characters/relations/cleanup', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  try {
    await projectService.getProject(projectId, userId);
    const result = await relationService.cleanupOrphanRelations(projectId);
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '清理孤儿关系失败';
    return c.json({ success: false, error: { code: 'CLEANUP_FAILED', message, retryable: true }, requestId }, 500);
  }
});

export { relations };
