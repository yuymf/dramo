import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { config } from '../config';
import { logger } from './logger';
import { startWorkflowRun } from './agentos-client';

/**
 * SSE event types used across all streaming endpoints.
 */
export type SSEEventType = 'data' | 'progress' | 'error' | 'done' | 'timeout' | 'heartbeat';

export interface SSEEvent {
  event: SSEEventType;
  data: unknown;
  id?: string;
}

export interface SSESessionState {
  sessionId: string;
  cursor: number;
  accumulatedData: string[];
  startTime: number;
}

/**
 * Create a new SSE session state for tracking streaming progress.
 */
export function createSSESession(): SSESessionState {
  return {
    sessionId: crypto.randomUUID(),
    cursor: 0,
    accumulatedData: [],
    startTime: Date.now(),
  };
}

/**
 * Check if the SSE session is approaching the Vercel timeout.
 * Returns true when we should send a timeout event and close.
 */
export function isApproachingTimeout(session: SSESessionState): boolean {
  const elapsed = Date.now() - session.startTime;
  return elapsed >= config.sseTimeoutMs;
}

/**
 * Stream SSE events from an async generator to the client.
 * Handles heartbeats, timeout detection, and proper SSE formatting.
 *
 * @param c - Hono context
 * @param generator - Async generator yielding SSE events
 * @param session - Optional session state for resume support
 */
export function streamSSEResponse(
  c: Context,
  generator: AsyncGenerator<SSEEvent, void, unknown>,
  session?: SSESessionState
) {
  const sseSession = session ?? createSSESession();

  return streamSSE(c, async (stream) => {
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    try {
      // Send initial session info for resume support
      await stream.writeSSE({
        event: 'data',
        data: JSON.stringify({
          type: 'session',
          sessionId: sseSession.sessionId,
        }),
        id: String(sseSession.cursor++),
      });

      // Start heartbeat to keep connection alive
      heartbeatTimer = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ ts: Date.now() }),
          });
        } catch {
          // Connection closed, heartbeat will be cleaned up
        }
      }, config.sseHeartbeatMs);

      for await (const event of generator) {
        // Check timeout before writing
        if (isApproachingTimeout(sseSession)) {
          await stream.writeSSE({
            event: 'timeout',
            data: JSON.stringify({
              sessionId: sseSession.sessionId,
              cursor: sseSession.cursor,
              message: 'Approaching timeout. Reconnect to resume.',
            }),
            id: String(sseSession.cursor++),
          });
          break;
        }

        // Track data events for resume
        if (event.event === 'data') {
          sseSession.accumulatedData.push(
            typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
          );
        }

        await stream.writeSSE({
          event: event.event,
          data: typeof event.data === 'string' ? event.data : JSON.stringify(event.data),
          id: event.id ?? String(sseSession.cursor++),
        });
      }
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    }
  });
}

/**
 * AgentOS Agno workflow SSE event types.
 * These are the events emitted by Agno workflows via SSE.
 */
type AgentOSEventType =
  | 'WorkflowStarted'
  | 'RunResponse'
  | 'RunResponseExtraData'
  | 'WorkflowCompleted'
  | 'WorkflowError'
  | string; // Other event types we may not know about

/**
 * Create an async generator from an AgentOS SSE response.
 * Parses the SSE text stream from AgentOS into structured events.
 *
 * Maps AgentOS event types to our internal SSE event types:
 *   - RunResponse → data (with content extraction)
 *   - WorkflowCompleted → done
 *   - WorkflowError → error
 *   - WorkflowStarted → ignored
 */
export async function* parseAgentOSSSE(
  response: Response
): AsyncGenerator<SSEEvent, void, unknown> {
  if (!response.body) {
    yield { event: 'error', data: { message: 'No response body' } };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Persist across chunks — NOT reset per iteration
  let currentEvent: AgentOSEventType = 'data';
  let dataLines: string[] = [];

  function dispatchBuffer(): SSEEvent | null {
    const rawData = dataLines.join('\n');
    dataLines = [];

    if (!rawData) {
      currentEvent = 'data';
      return null;
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      parsedData = rawData;
    }

    const eventType = currentEvent;
    currentEvent = 'data'; // reset for next event

    // Map AgentOS event types to our internal types
    switch (eventType) {
      case 'RunResponse': {
        // Agno RunResponse contains the actual content
        const data = parsedData as Record<string, unknown>;
        const content = data?.content ?? data?.output ?? data?.text ?? '';
        return { event: 'data', data: { content, ...data } };
      }

      case 'WorkflowCompleted': {
        // Agno WorkflowCompleted may carry the workflow output (for non-streaming steps)
        const data = parsedData as Record<string, unknown>;
        const output = data?.output ?? data?.content ?? data?.result ?? '';
        return { event: 'done', data: { output, ...data } };
      }

      case 'WorkflowError': {
        const data = parsedData as Record<string, unknown>;
        const message = (data?.error as string) || (data?.message as string) || 'Workflow error';
        logger.warn({ event: eventType, data: parsedData }, 'AgentOS workflow error event');
        return { event: 'error', data: { message, ...data } };
      }

      case 'WorkflowStarted':
      case 'RunResponseExtraData': {
        // Informational — skip
        return null;
      }

      default: {
        // Unknown event types: pass through as 'data'
        return { event: eventType as SSEEventType, data: parsedData };
      }
    }
  }

  let doneEmitted = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim() as AgentOSEventType;
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        } else if (line === '') {
          const event = dispatchBuffer();
          if (event) {
            if (event.event === 'done' || event.event === 'error') {
              doneEmitted = true;
            }
            yield event;
          }
        }
      }
    }

    // Process any remaining buffered event
    if (dataLines.length > 0) {
      const event = dispatchBuffer();
      if (event) {
        if (event.event === 'done' || event.event === 'error') {
          doneEmitted = true;
        }
        yield event;
      }
    }

    // Only emit a synthetic done if AgentOS didn't send WorkflowCompleted/Error
    if (!doneEmitted) {
      yield { event: 'done', data: { message: 'Stream complete' } };
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Unified AgentOS stream wrapper ───────────────────────────────────────────

export interface AgentOSStreamOptions {
  /** AgentOS workflow id, e.g. 'clarificationworkflow' */
  endpoint: string;
  /** Payload forwarded to AgentOS */
  payload: Record<string, unknown>;
  /** LLM headers for AgentOS (from LLMConfigService.getLLMHeaders) */
  llmHeaders?: Record<string, string>;
  /** Called for each SSE event received from AgentOS */
  onEvent?: (event: SSEEvent) => Promise<void>;
  /** Called with the final WorkflowCompleted payload */
  onComplete?: (result: unknown) => Promise<void>;
}

/**
 * Unified entry point: start an AgentOS workflow, pipe SSE to client.
 * Replaces scattered streamSSEResponse + parseAgentOSSSE call patterns.
 */
export async function createAgentOSStream(
  c: Context,
  opts: AgentOSStreamOptions
): Promise<Response> {
  if (!opts?.endpoint) throw new TypeError('createAgentOSStream: endpoint is required');
  if (!opts?.payload) throw new TypeError('createAgentOSStream: payload is required');

  async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      const response = await startWorkflowRun(
        opts.endpoint,
        opts.payload,
        { stream: true, llmHeaders: opts.llmHeaders }
      );
      for await (const event of parseAgentOSSSE(response)) {
        if (opts.onEvent) await opts.onEvent(event);
        if (event.event === 'done' && opts.onComplete) {
          await opts.onComplete((event.data as Record<string, unknown>)?.output);
        }
        yield event;
      }
    } catch (err) {
      logger.error({ err, endpoint: opts.endpoint }, 'AgentOS stream failed');
      yield { event: 'error', data: { message: 'Workflow failed' } };
    }
  }

  return streamSSEResponse(c, generateSSE());
}
