import { Hono } from 'hono';
import { startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';
import { prisma } from '../lib/db';

const characters = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

/**
 * SSE streaming endpoint for character extraction.
 * Replaces Redis-cached version — cache removed for serverless simplicity.
 */
characters.get('/projects/:projectId/characters/extract/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const text = c.req.query('text');

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空' } }, 400);
  }

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      yield { event: 'progress', data: { percent: 5, message: 'Starting character extraction...' } };

      const response = await startWorkflowRun('charactersworkflow', {
        projectId,
        text,
      }, { stream: true, llmHeaders });

      for await (const event of parseAgentOSSSE(response)) {
        yield event;
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Characters extraction SSE failed');
      yield { event: 'error', data: { message: '提取角色信息失败' } };
    }
  }

  return streamSSEResponse(c, generateSSE());
});

/**
 * Non-streaming character extraction.
 */
characters.post('/projects/:projectId/characters/extract', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const { text } = await c.req.json();

  if (!text || text.trim().length === 0) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空', retryable: false }, requestId }, 400);
  }

  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    const response = await startWorkflowRun('charactersworkflow', {
      projectId,
      text,
    }, { stream: false, llmHeaders });

    const result = await response.json() as Record<string, unknown>;

    // AgentOS wraps the result: { content: "{...json...}", workflow_id, ... }
    // Parse the inner content to get the actual character data
    let characterData: Record<string, unknown> = result;
    if (typeof result?.content === 'string') {
      try {
        characterData = JSON.parse(result.content);
      } catch {
        logger.warn({ projectId }, 'Failed to parse characters content string');
      }
    }

    // Persist extracted characters to CharacterAsset table
    // Clear existing assets for this project first (extraction is a replace operation)
    await prisma.characterRelation.deleteMany({ where: { nodeA: { projectId } } });
    await prisma.characterAsset.deleteMany({ where: { projectId } });

    const newChars = Array.isArray((characterData as Record<string, unknown>)?.new_characters) ? (characterData as { new_characters: Record<string, unknown>[] }).new_characters : [];
    const savedIds: string[] = [];
    for (const char of newChars) {
      try {
        const asset = await prisma.characterAsset.create({
          data: {
            projectId,
            name: (char.name as string) || '未命名角色',
            description: (char.description as string | undefined) || (char.personality as string | undefined) || undefined,
            alias: (char.alias as string | undefined) || undefined,
            images: [],
          },
        });
        savedIds.push(asset.id);
      } catch (saveErr) {
        logger.warn({ saveErr, projectId, charName: char.name }, 'Failed to save extracted character');
      }
    }

    logger.info({ projectId, extracted: newChars.length, saved: savedIds.length }, 'Characters extracted and persisted');

    return c.json(characterData);
  } catch (err) {
    logger.error({ err, projectId }, 'Characters extraction failed');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '提取角色信息失败', retryable: true }, requestId }, 502);
  }
});

export { characters };
