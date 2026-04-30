import { Hono } from 'hono';
import { prisma } from '../lib/db';
import { startWorkflowRun } from '../lib/agentos-client';
import { streamSSEResponse, parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';
import { LLMConfigService } from '../services/llm-config.service';
import { parseAgentResponse } from '../lib/parse-agent-response';
import type { ParsedAgentResponse } from '../lib/parse-agent-response';

const chat = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

const CHAT_HISTORY_WINDOW = 20;
const MAX_CONTENT_LENGTH = 10_000;
const ALLOWED_MESSAGE_TYPES = new Set(['text', 'options', 'progress', null, undefined]);

/**
 * Detect if user message expresses intent to start generation.
 * This is a server-side fallback when the LLM fails to set clarificationComplete.
 */
const GENERATION_TRIGGER_PATTERNS = [
  /^(开始|就这样|生成|直接生成|直接|好了|行了|够了|走起)$/,
  /(开始生成|生成台本|生成完整|直接生成|开始吧|直接开始|可以开始|不用问|别问了)/,
  /(帮我写|帮我生成|直接写|赶紧写|快写|马上生成)/,
  /(可以了|差不多了|就这样吧|就按这个|按这个来)/,
];

function isGenerationTrigger(userContent: string): boolean {
  const text = userContent.trim();
  return GENERATION_TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Build a fallback clarificationComplete from conversation history
 * when the LLM fails to produce one despite user triggering generation.
 */
function buildFallbackClarificationComplete(
  messages: Array<{ role: string; content: string }>
): Record<string, unknown> {
  // Combine all user messages to extract context
  const userTexts = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  // Detect contentType
  let contentType = 'live';
  if (/vlog/i.test(userTexts)) contentType = 'vlog';
  else if (/短剧|短片/.test(userTexts)) contentType = 'short_drama';
  else if (/短视频/.test(userTexts)) contentType = 'short_video';
  else if (/电影/.test(userTexts)) contentType = 'film';
  else if (/直播/.test(userTexts)) contentType = 'live';

  // Detect styles
  const styleMap: Record<string, string> = {
    '搞笑|幽默|逗|好笑': 'humorous',
    '治愈|温暖|舒服': 'healing',
    '热血|激情|燃': 'passionate',
    '悬疑|烧脑': 'suspense',
    '恐怖|惊悚': 'horror',
    '荒诞|离谱': 'absurd',
    '文艺|文学': 'literary',
    '怀旧|复古': 'retro',
  };
  const styles: string[] = [];
  for (const [pattern, style] of Object.entries(styleMap)) {
    if (new RegExp(pattern).test(userTexts)) {
      styles.push(style);
    }
  }
  if (styles.length === 0) styles.push('humorous');

  return {
    contentType,
    styles,
    goal: 'entertainment',
    keyword: userTexts.slice(0, 20),
    topic: userTexts.slice(0, 50),
    situation: '',
    extraRequirements: '',
  };
}

/**
 * Validate that a sessionId belongs to the given project. Returns true if valid or absent.
 */
async function validateSessionId(sessionId: string | undefined | null, projectId: string): Promise<boolean> {
  if (!sessionId) return true;
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, projectId },
    select: { id: true },
  });
  return !!session;
}

chat.get('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const sessionId = c.req.query('sessionId');

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  const where: Record<string, unknown> = { projectId };
  if (sessionId) {
    where.sessionId = sessionId;
  }

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return c.json({ data: messages, projectId });
});

/**
 * Send message — supports SSE streaming via `stream: true` in request body.
 */
chat.post('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  // Validate content
  const content = typeof body.content === 'string' ? body.content : '';
  if (!content.trim()) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Message content is required', retryable: false }, requestId }, 400);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return c.json({ error: { code: 'INVALID_INPUT', message: `Message too long (max ${MAX_CONTENT_LENGTH} chars)`, retryable: false }, requestId }, 400);
  }

  // Validate messageType
  if (!ALLOWED_MESSAGE_TYPES.has(body.messageType as string | null | undefined)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid messageType', retryable: false }, requestId }, 400);
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  // Validate sessionId belongs to this project
  const sessionId = (body.sessionId as string) || null;
  if (sessionId) {
    const sessionValid = await validateSessionId(sessionId, projectId);
    if (!sessionValid) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found', retryable: false }, requestId }, 404);
    }
  }

  // Store user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      projectId,
      sessionId,
      role: 'user',
      content,
      blocks: (body.blocks as object[]) || [],
      messageType: (body.messageType as string) || null,
      selectedOption: (body.selectedOption as object) || null,
    },
  });

  // Get conversation history (latest N, scoped by session if provided)
  const historyWhere: Record<string, unknown> = { projectId };
  if (sessionId) {
    historyWhere.sessionId = sessionId;
  }

  const history = await prisma.chatMessage.findMany({
    where: historyWhere,
    orderBy: { createdAt: 'desc' },
    take: CHAT_HISTORY_WINDOW,
  });
  // Use spread + reverse to avoid mutating the Prisma result array
  const messages = [...history].reverse().map((msg: { role: string; content: string }) => ({
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
        let doneFired = false;
        let structuredResult: ReturnType<typeof parseAgentResponse> | null = null;

        for await (const event of parseAgentOSSSE(response)) {
          if (event.event === 'data') {
            const data = event.data as Record<string, unknown>;
            const chunk = (data?.content as string) || '';

            // Scenario 1: The RunResponse data object itself carries structured fields
            // (parseAgentOSSSE spreads the full RunResponse, so options/clarificationComplete
            //  may be sibling fields alongside content)
            const hasDirectOptions = data?.options && typeof data.options === 'object' && Array.isArray((data.options as Record<string, unknown>).items);
            const hasDirectClarification = data?.clarificationComplete && typeof data.clarificationComplete === 'object';

            if (hasDirectOptions || hasDirectClarification) {
              structuredResult = {
                content: chunk,
                options: hasDirectOptions ? (data.options as ParsedAgentResponse['options']) : undefined,
                clarificationComplete: hasDirectClarification ? (data.clarificationComplete as Record<string, unknown>) : undefined,
              };
              fullContent = '';  // Clear any accumulated content — structured data goes via done event
            } else if (chunk) {
              // Scenario 2: The content string itself is a JSON-encoded structured response
              // (happens when Agno sends the full result as RunResponse before WorkflowCompleted)
              const maybeParsed = parseAgentResponse(chunk);
              if (maybeParsed.options || maybeParsed.clarificationComplete) {
                structuredResult = maybeParsed;
                fullContent = '';  // Clear any accumulated content
              } else {
                fullContent += chunk;
                yield { event: 'data', data: { content: chunk } };
              }
            }
          } else if (event.event === 'error') {
            // WorkflowError from AgentOS — surface to frontend
            const data = event.data as Record<string, unknown>;
            const errorMsg = (data?.error as string) || (data?.message as string) || 'AI workflow error';
            logger.warn({ errorMsg, projectId }, 'AgentOS workflow error in SSE');
            yield { event: 'error', data: { message: errorMsg } };
            return; // Stop processing
          } else if (event.event === 'done' && !doneFired) {
            doneFired = true;
            // For non-streaming workflows (like clarification), the full output
            // may be in the done event's data.output rather than accumulated chunks
            const doneData = event.data as Record<string, unknown>;
            const workflowOutput = (doneData?.output as string) || '';
            const rawContent = fullContent || workflowOutput;

            // Use the pre-parsed structured result if we captured one from RunResponse,
            // otherwise parse from the accumulated/done content
            const parsed = structuredResult || parseAgentResponse(rawContent);

            // Fallback: if user expressed generation intent but LLM didn't set clarificationComplete,
            // construct one from conversation history
            if (!parsed.clarificationComplete && isGenerationTrigger(content)) {
              logger.info({ projectId, userContent: content }, 'LLM missed generation trigger — applying server-side fallback');
              parsed.clarificationComplete = buildFallbackClarificationComplete(messages);
            }

            await prisma.chatMessage.create({
              data: {
                projectId,
                sessionId,
                role: 'assistant',
                // When clarificationComplete is set, content may legitimately be empty.
                // Never fall back to rawContent (which may be raw JSON) — use parsed.content.
                content: parsed.content || (parsed.clarificationComplete ? '' : rawContent) || 'No response',
                messageType: parsed.options ? 'options' : null,
                options: parsed.options ? (parsed.options as object) : undefined,
              },
            });

            if (parsed.clarificationComplete) {
              await prisma.pipelineRun.create({
                data: {
                  projectId,
                  status: 'running',
                  requirements: parsed.clarificationComplete as object,
                  currentStep: 'script',
                },
              });
            }

            yield {
              event: 'done',
              data: {
                // Same logic: don't fall back to rawContent when structured data is present
                content: parsed.content || (parsed.clarificationComplete ? '' : rawContent),
                options: parsed.options || undefined,
                clarificationComplete: parsed.clarificationComplete || undefined,
              },
            };
          }
        }
      } catch (err) {
        logger.error({ err, projectId }, 'Chat SSE failed');
        const errMsg = (err instanceof Error ? err.message : String(err)) || '';
        const errCode = err instanceof AppException ? err.code : '';
        // Surface actionable error messages to the user
        let userMessage = 'AI 服务暂不可用，请稍后重试';
        if (errCode === ErrorCode.LLM_NOT_CONFIGURED || errMsg.includes('LLM configuration') || errMsg.includes('No default')) {
          userMessage = '请先在设置页面配置 LLM API Key';
        } else if (errMsg.includes('AGENTOS_TIMEOUT')) {
          userMessage = 'AI 服务响应超时，请稍后重试';
        } else if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
          userMessage = 'AI 服务未启动或不可用，请检查 AgentOS 服务状态';
        }
        yield { event: 'error', data: { message: userMessage } };
      }
    }

    return streamSSEResponse(c, generateSSE());
  }

  // Non-streaming response
  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

    const response = await startWorkflowRun('clarificationworkflow', {
      messages,
      stream: false,
    }, { requestId, stream: false, llmHeaders });

    const responseText = await response.text();
    const parsed = parseAgentResponse(responseText);

    // Fallback: if user expressed generation intent but LLM didn't set clarificationComplete,
    // construct one from conversation history
    if (!parsed.clarificationComplete && isGenerationTrigger(content)) {
      logger.info({ projectId, userContent: content }, 'LLM missed generation trigger — applying server-side fallback (non-streaming)');
      parsed.clarificationComplete = buildFallbackClarificationComplete(messages);
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        projectId,
        sessionId,
        role: 'assistant',
        content: parsed.content,
        messageType: parsed.options ? 'options' : null,
        options: parsed.options ? (parsed.options as object) : undefined,
      },
    });

    if (parsed.clarificationComplete) {
      await prisma.pipelineRun.create({
        data: {
          projectId,
          status: 'running',
          requirements: parsed.clarificationComplete as object,
          currentStep: 'script',
        },
      });
    }

    return c.json({
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        clarificationComplete: parsed.clarificationComplete || undefined,
      },
    });
  } catch (err) {
    logger.error({ err, projectId }, 'Chat completion failed');
    const errCode = err instanceof AppException ? err.code : '';
    const errMsg = err instanceof Error ? err.message : '';
    if (errCode === ErrorCode.LLM_NOT_CONFIGURED || errMsg.includes('No default')) {
      return c.json({ error: { code: 'LLM_NOT_CONFIGURED', message: '请先在设置页面配置 LLM API Key', retryable: false }, requestId }, 400);
    }
    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
      return c.json({ error: { code: 'UPSTREAM_ERROR', message: 'AI 服务未启动或不可用', retryable: true }, requestId }, 502);
    }
    throw err;
  }
});

chat.post('/chat/:projectId/reset', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const sessionId = body.sessionId as string | undefined;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
  }

  const deleteWhere: Record<string, unknown> = { projectId };
  if (sessionId) {
    deleteWhere.sessionId = sessionId;
  }

  await prisma.chatMessage.deleteMany({ where: deleteWhere });

  return c.json({ projectId, reset: true, message: '对话已重置' });
});

export { chat };
