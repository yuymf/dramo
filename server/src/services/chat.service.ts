import { prisma } from '../lib/db';
import { startWorkflowRun } from '../lib/agentos-client';
import { parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { LLMConfigService } from './llm-config.service';
import { parseAgentResponse } from '../lib/parse-agent-response';
import type { ParsedAgentResponse } from '../lib/parse-agent-response';

const CHAT_HISTORY_WINDOW = 20;

/**
 * Chat Service — message persistence, history, session validation,
 * and SSE streaming generation.
 */
export class ChatService {
  private llmConfigService: LLMConfigService;

  constructor() {
    this.llmConfigService = new LLMConfigService();
  }

  /**
   * Validate that a sessionId belongs to the given project.
   * Returns true if sessionId is absent (no session scoping).
   */
  async validateSessionId(sessionId: string | undefined | null, projectId: string): Promise<boolean> {
    if (!sessionId) return true;
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, projectId },
      select: { id: true },
    });
    return !!session;
  }

  /**
   * List messages for a project, optionally scoped by sessionId.
   */
  async listMessages(projectId: string, sessionId?: string) {
    const where: Record<string, unknown> = { projectId };
    if (sessionId) where.sessionId = sessionId;
    return prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Persist a user message and return the record.
   */
  async createUserMessage(data: {
    projectId: string;
    sessionId: string | null;
    content: string;
    messageType?: string | null;
    selectedOption?: object;
  }) {
    return prisma.chatMessage.create({
      data: {
        projectId: data.projectId,
        sessionId: data.sessionId,
        role: 'user',
        content: data.content,
        messageType: data.messageType ?? null,
        selectedOption: data.selectedOption ?? undefined,
      },
    });
  }

  /**
   * Fetch the last N messages for context, in chronological order.
   */
  async getHistory(projectId: string, sessionId: string | null): Promise<Array<{ role: string; content: string }>> {
    const where: Record<string, unknown> = { projectId };
    if (sessionId) where.sessionId = sessionId;
    const rows = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: CHAT_HISTORY_WINDOW,
    });
    return [...rows].reverse().map((msg) => ({ role: msg.role, content: msg.content }));
  }

  /**
   * Delete all messages for a project, optionally scoped by sessionId.
   */
  async deleteMessages(projectId: string, sessionId?: string) {
    const where: Record<string, unknown> = { projectId };
    if (sessionId) where.sessionId = sessionId;
    return prisma.chatMessage.deleteMany({ where });
  }

  /**
   * Persist the assistant reply.
   */
  private async persistAssistantReply(
    projectId: string,
    sessionId: string | null,
    parsed: ParsedAgentResponse,
    rawContent: string
  ) {
    return prisma.chatMessage.create({
      data: {
        projectId,
        sessionId,
        role: 'assistant',
        content: parsed.content || (parsed.clarificationComplete ? '' : rawContent) || 'No response',
        messageType: parsed.options ? 'options' : null,
        options: parsed.options ? (parsed.options as object) : undefined,
      },
    });
  }

  /**
   * Async generator that drives the SSE streaming path for the chat endpoint.
   * Yields SSEEvents to be piped through streamSSEResponse().
   */
  async *generateSSE(params: {
    userId: string;
    projectId: string;
    sessionId: string | null;
    userContent: string;
    messages: Array<{ role: string; content: string }>;
    requestId: string;
  }): AsyncGenerator<SSEEvent, void, unknown> {
    const { userId, projectId, sessionId, messages, requestId } = params;

    try {
      const llmHeaders = await this.llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
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

          const hasDirectOptions =
            data?.options &&
            typeof data.options === 'object' &&
            Array.isArray((data.options as Record<string, unknown>).items);
          const hasDirectClarification =
            data?.clarificationComplete && typeof data.clarificationComplete === 'object';

          if (hasDirectOptions || hasDirectClarification) {
            structuredResult = {
              content: chunk,
              options: hasDirectOptions ? (data.options as ParsedAgentResponse['options']) : undefined,
              clarificationComplete: hasDirectClarification
                ? (data.clarificationComplete as Record<string, unknown>)
                : undefined,
            };
            fullContent = '';
          } else if (chunk) {
            const maybeParsed = parseAgentResponse(chunk);
            if (maybeParsed.options || maybeParsed.clarificationComplete) {
              structuredResult = maybeParsed;
              fullContent = '';
            } else {
              fullContent += chunk;
              yield { event: 'data', data: { content: chunk } };
            }
          }
        } else if (event.event === 'error') {
          const data = event.data as Record<string, unknown>;
          const errorMsg = (data?.error as string) || (data?.message as string) || 'AI workflow error';
          logger.warn({ errorMsg, projectId }, 'AgentOS workflow error in SSE');
          yield { event: 'error', data: { message: errorMsg } };
          return;
        } else if (event.event === 'done' && !doneFired) {
          doneFired = true;
          const doneData = event.data as Record<string, unknown>;
          const workflowOutput = (doneData?.output as string) || '';
          const rawContent = fullContent || workflowOutput;
          const parsed = structuredResult || parseAgentResponse(rawContent);

          await this.persistAssistantReply(projectId, sessionId, parsed, rawContent);

          yield {
            event: 'done',
            data: {
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

}
