import { Hono } from 'hono';
import { createAgentOSStream } from '../lib/sse';
import { LLMConfigService } from '../services/llm-config.service';
import type { AuthEnv } from '../middleware/default-user';

const director = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

director.post('/projects/:projectId/scripts/:scriptId/director', async (c) => {
  const projectId = c.req.param('projectId');
  const scriptId = c.req.param('scriptId');
  const userId = c.get('user').userId;
  const { scriptContext } = await c.req.json<{ scriptContext: unknown }>();

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  return createAgentOSStream(c, {
    endpoint: 'directorworkflow',
    payload: { project_id: projectId, script_id: scriptId, script_context: scriptContext },
    llmHeaders,
  });
});

export { director };
