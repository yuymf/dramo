import { Hono } from 'hono';
import { ScriptService } from '../services/script.service';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';

const scripts = new Hono<AuthEnv>();
const scriptService = new ScriptService();
const llmConfigService = new LLMConfigService();

scripts.get('/api/projects/:projectId/script', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');

  const script = await scriptService.getProjectScript(projectId, userId);
  if (!script) {
    return c.json({ error: { code: 'NOT_FOUND', message: '台本不存在', retryable: false }, requestId }, 404);
  }
  return c.json(script);
});

/**
 * Script generation — synchronous via AgentOS (no BullMQ).
 */
scripts.post('/api/projects/:projectId/script', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json();

  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    const result = await scriptService.createScript(projectId, userId, body, llmHeaders);
    return c.json(result.script, 201);
  } catch (err) {
    logger.error({ err, projectId }, 'Script generation failed');
    throw err;
  }
});

scripts.patch('/api/projects/:projectId/script/content', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const { scenes, acts } = await c.req.json();

  const script = await scriptService.updateScriptContent(projectId, userId, { scenes, acts });
  return c.json(script);
});

scripts.post('/api/projects/:projectId/script/scenes/:sceneId/regenerate', async (c) => {
  const projectId = c.req.param('projectId');
  const sceneId = c.req.param('sceneId');
  const userId = c.get('user').userId;
  const body = await c.req.json();

  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    const result = await scriptService.regenerateScene(projectId, sceneId, userId, body, llmHeaders);
    return c.json(result);
  } catch (err) {
    logger.error({ err, projectId, sceneId }, 'Scene regeneration failed');
    throw err;
  }
});

scripts.get('/api/projects/:projectId/script/versions', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;

  const versions = await scriptService.listVersions(projectId, userId);
  return c.json(versions);
});

scripts.post('/api/projects/:projectId/script/versions/:versionId/revert', async (c) => {
  const projectId = c.req.param('projectId');
  const versionId = c.req.param('versionId');
  const userId = c.get('user').userId;

  const result = await scriptService.revertToVersion(projectId, versionId, userId);
  return c.json(result);
});

export { scripts };
