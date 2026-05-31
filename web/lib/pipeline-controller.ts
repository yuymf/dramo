import { usePipelineStore } from '@/lib/stores/pipeline-store';
import type { PipelineStep, StructuredRequirements } from '@/lib/types/chat';

/** Maps pipeline steps to their API endpoints and left-side tab names */
const STEP_CONFIG: Record<
  Exclude<PipelineStep, 'clarification'>,
  { endpoint: (projectId: string) => string; tab: string }
> = {
  script: {
    endpoint: (id) => `/api/projects/${id}/script`,
    tab: 'scripts',
  },
  characters: {
    endpoint: (id) => `/api/projects/${id}/characters/extract`,
    tab: 'characters',
  },
  locations: {
    endpoint: (id) => `/api/projects/${id}/locations/extract`,
    tab: 'locations',
  },
  storyboard: {
    endpoint: (id) => `/api/projects/${id}/storyboard/import`,
    tab: 'storyboard',
  },
};

const GENERATION_STEPS: Exclude<PipelineStep, 'clarification'>[] = [
  'script',
  'characters',
  'locations',
  'storyboard',
];

export interface PipelineCallbacks {
  onStepStart: (step: PipelineStep) => void;
  onStepComplete: (step: PipelineStep) => void;
  onChunk: (step: PipelineStep, data: unknown) => void;
  onTabSwitch: (tab: string) => void;
  onError: (step: PipelineStep, error: string) => void;
  onDone: () => void;
  /**
   * Called after `script` step completes. The pipeline suspends until the
   * returned Promise resolves. Reject (or abort signal) to cancel the run.
   */
  onConfirmRequired?: (step: 'script') => Promise<void>;
}

/**
 * Runs the generation pipeline: script → characters → locations → storyboard.
 * Each step calls the existing API with SSE streaming.
 * Returns an AbortController to allow interruption.
 */
export function runPipeline(
  projectId: string,
  requirements: StructuredRequirements,
  scriptId: string | null,
  callbacks: PipelineCallbacks
): AbortController {
  const controller = new AbortController();
  const store = usePipelineStore.getState();

  store.setAbortController(controller);
  store.setPipelineStatus('running');

  (async () => {
    let currentScriptId = scriptId;
    let scriptText = '';

    for (const step of GENERATION_STEPS) {
      if (controller.signal.aborted) break;

      const config = STEP_CONFIG[step];

      store.updateTaskStatus(step, 'in_progress');
      store.setCurrentStep(step);
      callbacks.onStepStart(step);
      callbacks.onTabSwitch(config.tab);

      try {
        const body = buildStepBody(step, requirements, currentScriptId, scriptText);

        const result = await executeSSEStep(
          config.endpoint(projectId),
          body,
          controller.signal,
          (chunk) => callbacks.onChunk(step, chunk)
        );

        // Capture script ID and text for downstream steps
        if (step === 'script' && result) {
          if (result.id) {
            currentScriptId = result.id as string;
          }
          scriptText = extractScriptText(result);
        }

        store.updateTaskStatus(step, 'completed');
        callbacks.onStepComplete(step);

        // Notify left-side tab components to refresh their data
        window.dispatchEvent(
          new CustomEvent('pipeline-step-complete', { detail: { step, tab: config.tab } })
        );

        // After script is done, pause and wait for user confirmation before
        // proceeding to characters / locations / storyboard.
        if (step === 'script' && callbacks.onConfirmRequired) {
          store.setPipelineStatus('waiting_confirm');
          try {
            await callbacks.onConfirmRequired('script');
          } catch {
            // User cancelled or component unmounted — abort the run
            store.setPipelineStatus('paused');
            return;
          }
          store.setPipelineStatus('running');
          if (controller.signal.aborted) break;
        }
      } catch (err) {
        if (controller.signal.aborted) {
          store.updateTaskStatus(step, 'paused');
          store.setPipelineStatus('paused');
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        store.updateTaskStatus(step, 'failed');
        callbacks.onError(step, message);
      }
    }

    if (!controller.signal.aborted) {
      store.setPipelineStatus('done');
      callbacks.onDone();
    }
  })();

  return controller;
}

function buildStepBody(
  step: Exclude<PipelineStep, 'clarification'>,
  requirements: StructuredRequirements,
  scriptId: string | null,
  scriptText: string
): Record<string, unknown> {
  switch (step) {
    case 'script':
      return {
        source: 'structured',
        form: 'linear',
        contentType: requirements.contentType,
        styles: requirements.styles,
        goal: requirements.goal,
        keyword: requirements.keyword,
        topic: requirements.topic,
        situation: requirements.situation,
        hot_stuffs: requirements.hotStuffs,
      };
    case 'characters':
      return { scriptId, text: scriptText };
    case 'locations':
      return { scriptId, text: scriptText };
    case 'storyboard':
      return { scriptId, text: scriptText, stream: true };
    default:
      return {};
  }
}

/**
 * Extracts plain text from the script result object.
 * Script has scenes[] → blocks[] → text (may contain HTML).
 * Also handles the content[] format used by the Script model.
 * Strips HTML tags to produce clean text for downstream extraction.
 */
function extractScriptText(result: Record<string, unknown>): string {
  // AgentOS may wrap in { content: "json string" }
  let data = result;
  if (typeof result.content === 'string') {
    try {
      data = JSON.parse(result.content) as Record<string, unknown>;
    } catch {
      // content is not JSON, use result as-is
    }
  }

  const scenes = data.scenes as Array<{
    title?: string;
    blocks?: Array<{ text?: string }>;
    content?: Array<{ label?: string; text?: string }>;
  }> | undefined;

  if (!scenes || !Array.isArray(scenes)) {
    return '';
  }

  const parts: string[] = [];

  for (const scene of scenes) {
    if (scene.title) {
      parts.push(scene.title);
    }
    // Try blocks first (DB format), then content (model format)
    const items = scene.blocks || scene.content || [];
    if (Array.isArray(items)) {
      for (const block of items) {
        if (block.text) {
          parts.push(stripHtml(block.text));
        }
      }
    }
  }

  return parts.join('\n\n');
}

/** Removes HTML tags and decodes common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Executes an SSE-streaming API call.
 * Calls onChunk for each data event.
 * Returns the final parsed result when done.
 *
 * Special case: if the response is 202 Accepted with a `taskId`, polls
 * GET /api/tasks/:taskId until the task reaches a terminal state, then
 * returns the task result. This handles async endpoints like storyboard/import.
 */
async function executeSSEStep(
  endpoint: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onChunk: (data: unknown) => void
): Promise<Record<string, unknown> | null> {
  // Relative path routes through Next.js API Route, which proxies to the Hono backend.
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  // Async mode: server returns 202 + taskId, poll until done
  if (response.status === 202) {
    const json = await response.json() as { taskId?: string };
    if (json.taskId) {
      return pollTask(json.taskId, signal, onChunk);
    }
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let lastData: Record<string, unknown> | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            lastData = data as Record<string, unknown>;
            onChunk(data);
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    return lastData;
  }

  const result = await response.json();
  onChunk(result);
  return result as Record<string, unknown>;
}

/** Poll GET /api/tasks/:taskId until completed/failed, return task result. */
async function pollTask(
  taskId: string,
  signal: AbortSignal,
  onChunk: (data: unknown) => void,
  intervalMs = 3000,
  timeoutMs = 600_000,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (signal.aborted) return null;

    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, intervalMs);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });

    if (signal.aborted) return null;

    const res = await fetch(`/api/tasks/${taskId}`, {
      credentials: 'include',
      signal,
    });

    if (!res.ok) continue;

    const task = await res.json() as {
      status: string;
      result?: Record<string, unknown>;
      error?: { message?: string };
    };

    onChunk({ taskId, status: task.status });

    if (task.status === 'completed') {
      return task.result ?? null;
    }
    if (task.status === 'failed') {
      throw new Error(task.error?.message ?? 'Task failed');
    }
    // still processing / queued — keep polling
  }

  throw new Error(`Task ${taskId} timed out after ${timeoutMs / 1000}s`);
}
