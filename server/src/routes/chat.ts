import { Hono } from 'hono';
import { prisma } from '../lib/db';
import { postAgentOS, startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';

const chat = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

chat.get('/api/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  return c.json({ data: messages, projectId });
});

/**
 * Send message — supports SSE streaming via `stream: true` in request body.
 */
chat.post('/api/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json();

  if (!body.content || (typeof body.content === 'string' && !body.content.trim())) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Message content is required', retryable: false }, requestId }, 400);
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  // Store user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      projectId,
      role: 'user',
      content: body.content,
      blocks: body.blocks || [],
      messageType: body.messageType || null,
      selectedOption: body.selectedOption || null,
    },
  });

  // Get conversation history (latest 20)
  const history = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  history.reverse();

  const messages = history.map((msg: { role: string; content: string }) => ({
    role: msg.role,
    content: msg.content,
  }));

  if (body.stream) {
    // SSE streaming response
    // eslint-disable-next-line no-inner-declarations
    async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
      try {
        const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
        const response = await startWorkflowRun('clarificationworkflow', {
          messages,
          stream: true,
        }, { requestId, stream: true, llmHeaders });

        let fullContent = '';

        for await (const event of parseAgentOSSSE(response)) {
          if (event.event === 'data') {
            const data = event.data as Record<string, unknown>;
            const chunk = (data?.content as string) || (typeof event.data === 'string' ? event.data : '');
            if (chunk) {
              fullContent += chunk;
              yield { event: 'data', data: { content: chunk } };
            }
          } else if (event.event === 'done') {
            // Store assistant message
            await prisma.chatMessage.create({
              data: { projectId, role: 'assistant', content: fullContent || 'No response' },
            });
            yield { event: 'done', data: { content: fullContent } };
          }
        }
      } catch (err) {
        logger.error({ err, projectId }, 'Chat SSE failed');
        yield { event: 'error', data: { message: 'Chat generation failed' } };
      }
    }

    return streamSSEResponse(c, generateSSE());
  }

  // Non-streaming: route based on mode
  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    let content = '';
    let messageType: string | null = null;
    let options: unknown = null;
    let clarificationComplete: unknown = null;

    if (body.mode === 'clarification') {
      // Use ClarificationWorkflow
      const response = await startWorkflowRun('clarificationworkflow', {
        messages,
        stream: false,
      }, { requestId, stream: false, llmHeaders });

      const responseText = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        // AgentOS workflow wraps output: { content: "<json_string>" } or { output: "<json_string>" }
        const outer = JSON.parse(responseText);
        let inner = outer.output || outer.content || outer;
        // The workflow returns a JSON string, which may be nested
        if (typeof inner === 'string') {
          try { inner = JSON.parse(inner); } catch { /* keep as string */ }
        }
        // inner should now be { content, options, clarificationComplete }
        // But the LLM might return JSON inside content field too
        if (typeof inner === 'object' && inner !== null) {
          parsed = inner as Record<string, unknown>;
        } else {
          parsed = { content: String(inner) };
        }
        // If content itself is a JSON string with our expected fields, parse it
        if (typeof parsed.content === 'string' && parsed.content.startsWith('{')) {
          try {
            const innerContent = JSON.parse(parsed.content);
            if (innerContent.content) {
              parsed = innerContent;
            }
          } catch { /* content is just a string, keep it */ }
        }
      } catch {
        parsed = { content: responseText };
      }


      content = (parsed.content as string) || 'No response';

      if (parsed.options) {
        messageType = 'options';
        options = parsed.options;
      }

      if (parsed.clarificationComplete) {
        clarificationComplete = parsed.clarificationComplete;

        // Create PipelineRun record
        await prisma.pipelineRun.create({
          data: {
            projectId,
            status: 'running',
            requirements: parsed.clarificationComplete as object,
            currentStep: 'script',
          },
        });
      }
    } else {
      // Default: use ClarificationWorkflow as general chat
      const response = await startWorkflowRun('clarificationworkflow', {
        messages,
        stream: false,
      }, { requestId, stream: false, llmHeaders });

      const responseText = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        const outer = JSON.parse(responseText);
        let inner = outer.output || outer.content || outer;
        if (typeof inner === 'string') {
          try { inner = JSON.parse(inner); } catch { /* keep as string */ }
        }
        if (typeof inner === 'object' && inner !== null) {
          parsed = inner as Record<string, unknown>;
        } else {
          parsed = { content: String(inner) };
        }
        if (typeof parsed.content === 'string' && parsed.content.startsWith('{')) {
          try {
            const innerContent = JSON.parse(parsed.content);
            if (innerContent.content) {
              parsed = innerContent;
            }
          } catch { /* content is just a string, keep it */ }
        }
      } catch {
        parsed = { content: responseText };
      }

      content = (parsed.content as string) || 'No response';

      if (parsed.options) {
        messageType = 'options';
        options = parsed.options;
      }
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content,
        messageType,
        options: options ? (options as object) : undefined,
      },
    });

    // Add clarificationComplete to response (transient, not stored in DB)
    const responsePayload: Record<string, unknown> = {
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        clarificationComplete: clarificationComplete || undefined,
      },
    };

    return c.json(responsePayload);
  } catch (err) {
    logger.error({ err, projectId }, 'Chat completion failed');
    throw err;
  }
});

chat.post('/api/chat/:projectId/reset', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  await prisma.chatMessage.deleteMany({ where: { projectId } });

  return c.json({ projectId, reset: true, message: '对话已重置' });
});

export { chat };
