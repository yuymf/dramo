import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { config } from '../config';

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
 * Create an async generator from an AgentOS SSE response.
 * Parses the SSE text stream from AgentOS into structured events.
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = 'data';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentData = line.slice(5).trim();
        } else if (line === '' && currentData) {
          // Empty line = end of event
          let parsedData: unknown;
          try {
            parsedData = JSON.parse(currentData);
          } catch {
            parsedData = currentData;
          }

          yield {
            event: currentEvent as SSEEventType,
            data: parsedData,
          };

          currentEvent = 'data';
          currentData = '';
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(buffer.trim());
      } catch {
        parsedData = buffer.trim();
      }
      yield { event: 'data', data: parsedData };
    }

    yield { event: 'done', data: { message: 'Stream complete' } };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Simple SSE error response — sends a single error event then closes.
 */
export function streamSSEError(c: Context, code: string, message: string) {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'error',
      data: JSON.stringify({ code, message }),
    });
  });
}
