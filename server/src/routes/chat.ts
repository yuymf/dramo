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
    async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
      try {
        const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
        const response = await startWorkflowRun('ChatWorkflow', {
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
      const response = await startWorkflowRun('ClarificationWorkflow', {
        messages,
        stream: false,
      }, { requestId, stream: false, llmHeaders });

      const responseText = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        // AgentOS workflow returns JSON string in "output" or directly
        const outer = JSON.parse(responseText);
        const inner = outer.output || outer;
        parsed = typeof inner === 'string' ? JSON.parse(inner) : inner;
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
      // Default: call AgentOS chat_completion endpoint
      const aiResponse = await postAgentOS<{
        choices?: Array<{ message: { role: string; content: string } }>;
        content?: string;
        message?: string;
      }>('/agentos/chat_completion', { messages, stream: false }, { llmHeaders });

      content =
        aiResponse.choices?.[0]?.message?.content ||
        aiResponse.content ||
        aiResponse.message ||
        'No response';
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
