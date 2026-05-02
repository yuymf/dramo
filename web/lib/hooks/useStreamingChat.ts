import { useCallback, useRef, useState } from 'react';
import type { ChatMessageOptions, StructuredRequirements } from '@/lib/types/chat';

interface StreamingState {
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
}

interface StreamDonePayload {
  content: string;
  options?: ChatMessageOptions;
  clarificationComplete?: StructuredRequirements;
}

interface UseStreamingChatOptions {
  projectId: string;
  sessionId?: string | null;
  onStreamDone?: (payload: StreamDonePayload) => void;
  onError?: (error: string) => void;
}

const STREAM_API_PATH = '/api/chat';

/**
 * Parse SSE events from a ReadableStreamDefaultReader.
 * Maintains event/data state across chunk boundaries (critical for correct SSE parsing).
 * Supports multi-line `data:` fields per the SSE spec (concatenated with `\n`).
 */
async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: {
    onData: (parsed: Record<string, unknown>) => void;
    onDone: (parsed: Record<string, unknown>) => void;
    onError: (parsed: Record<string, unknown>) => void;
  },
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  // Persist across chunks — NOT reset per iteration
  let currentEvent = '';
  let dataLines: string[] = [];

  function dispatchEvent() {
    const rawData = dataLines.join('\n');
    if (!rawData) {
      currentEvent = '';
      dataLines = [];
      return;
    }

    try {
      const parsed = JSON.parse(rawData);

      if (currentEvent === 'done') {
        handlers.onDone(parsed);
      } else if (currentEvent === 'error') {
        handlers.onError(parsed);
      } else if (currentEvent === 'data') {
        handlers.onData(parsed);
      }
      // Ignore heartbeat and other events
    } catch {
      console.debug('[SSE] Non-JSON data line, skipping:', rawData.slice(0, 100));
    }

    currentEvent = '';
    dataLines = [];
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        // SSE spec: multiple data: lines are concatenated with \n
        dataLines.push(line.slice(5).trim());
      } else if (line === '') {
        // Empty line = end of event block
        dispatchEvent();
      }
    }
  }

  // Process any remaining buffered event
  if (dataLines.length > 0) {
    dispatchEvent();
  }
}

/**
 * Hook for streaming chat messages via SSE (POST + ReadableStream).
 *
 * Usage:
 *   const { sendStreamingMessage, streamingContent, isStreaming, abort } = useStreamingChat({ projectId });
 *   await sendStreamingMessage({ content: 'hello', mode: 'clarification' });
 */
export function useStreamingChat({
  projectId,
  sessionId,
  onStreamDone,
  onError,
}: UseStreamingChatOptions) {
  const [state, setState] = useState<StreamingState>({
    streamingContent: '',
    isStreaming: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const sendStreamingMessage = useCallback(
    async (body: Record<string, unknown>) => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({ streamingContent: '', isStreaming: true, error: null });

      let streamDoneFired = false;
      let accumulated = '';

      try {
        const requestBody = {
          ...body,
          stream: true,
          sessionId: sessionId || undefined,
        };

        const response = await fetch(
          `${STREAM_API_PATH}/${projectId}/messages/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            credentials: 'include',
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message =
            (errorData as Record<string, { message?: string }>)?.error?.message ||
            'Streaming failed';
          throw new Error(message);
        }

        const contentType = response.headers.get('content-type') || '';

        // Non-streaming fallback — backend returned JSON instead of SSE
        if (!contentType.includes('text/event-stream')) {
          const data = await response.json();
          const payload = data as {
            assistantMessage?: {
              content: string;
              options?: ChatMessageOptions;
              clarificationComplete?: StructuredRequirements;
            };
          };
          if (payload.assistantMessage) {
            streamDoneFired = true;
            setState({
              streamingContent: payload.assistantMessage.content,
              isStreaming: false,
              error: null,
            });
            onStreamDone?.({
              content: payload.assistantMessage.content,
              options: payload.assistantMessage.options,
              clarificationComplete: payload.assistantMessage.clarificationComplete,
            });
          } else {
            // No assistantMessage in non-SSE response — unblock UI
            streamDoneFired = true;
            setState((prev) => ({ ...prev, isStreaming: false }));
          }
          return;
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        await parseSSEStream(reader, {
          onData: (parsed) => {
            // Skip session init events
            if (parsed.type === 'session') return;

            const chunk = parsed.content as string;
            if (chunk) {
              // Last-mile defense: if a chunk looks like a full JSON agent response,
              // don't accumulate it as visible text — it will be handled by the done event.
              if (chunk.trimStart().startsWith('{')) {
                try {
                  // Try direct parse first, then sanitize control chars
                  let obj: Record<string, unknown> | null = null;
                  try {
                    obj = JSON.parse(chunk) as Record<string, unknown>;
                  } catch {
                    const sanitized = chunk.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
                    obj = JSON.parse(sanitized) as Record<string, unknown>;
                  }
                  if (obj && typeof obj.content === 'string' && (obj.options || obj.clarificationComplete || obj.options === null)) {
                    // Structured response leaked as a data chunk — skip accumulation.
                    // The real content will arrive in the done event.
                    return;
                  }
                } catch {
                  // Not JSON — it's genuine content, fall through
                }
              }
              accumulated += chunk;
              setState((prev) => ({ ...prev, streamingContent: accumulated }));
            }
          },
          onDone: (parsed) => {
            streamDoneFired = true;
            const finalContent = (parsed.content as string) || accumulated;
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              streamingContent: finalContent,
            }));
            onStreamDone?.({
              content: finalContent,
              options: parsed.options as ChatMessageOptions | undefined,
              clarificationComplete: parsed.clarificationComplete as StructuredRequirements | undefined,
            });
          },
          onError: (parsed) => {
            streamDoneFired = true;
            const errMsg = (parsed.message as string) || 'Streaming error';
            setState((prev) => ({ ...prev, isStreaming: false, error: errMsg }));
            onError?.(errMsg);
          },
        });

        // Stream ended without a done event — still unblock the UI
        if (!streamDoneFired) {
          setState((prev) => {
            if (prev.isStreaming) {
              return { ...prev, isStreaming: false };
            }
            return prev;
          });
          // Fire onStreamDone with whatever we accumulated so the ChatPanel can persist it
          if (accumulated) {
            onStreamDone?.({ content: accumulated });
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }

        const errorMessage = (err as Error).message || 'Streaming failed';
        setState((prev) => ({ ...prev, isStreaming: false, error: errorMessage }));
        if (!streamDoneFired) {
          onError?.(errorMessage);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [projectId, sessionId, onStreamDone, onError],
  );

  return {
    sendStreamingMessage,
    streamingContent: state.streamingContent,
    isStreaming: state.isStreaming,
    streamingError: state.error,
    abort,
  };
}
