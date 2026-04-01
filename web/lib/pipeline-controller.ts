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
    endpoint: (id) => `/api/projects/${id}/storyboard/generate`,
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

    for (const step of GENERATION_STEPS) {
      if (controller.signal.aborted) break;

      const config = STEP_CONFIG[step];

      store.updateTaskStatus(step, 'in_progress');
      store.setCurrentStep(step);
      callbacks.onStepStart(step);
      callbacks.onTabSwitch(config.tab);

      try {
        const body = buildStepBody(step, requirements, currentScriptId);

        const result = await executeSSEStep(
          config.endpoint(projectId),
          body,
          controller.signal,
          (chunk) => callbacks.onChunk(step, chunk)
        );

        // Capture script ID for downstream steps
        if (step === 'script' && result?.id) {
          currentScriptId = result.id as string;
        }

        store.updateTaskStatus(step, 'completed');
        callbacks.onStepComplete(step);
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
  scriptId: string | null
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
      return { scriptId };
    case 'locations':
      return { scriptId };
    case 'storyboard':
      return { scriptId, stream: true };
    default:
      return {};
  }
}

/**
 * Executes an SSE-streaming API call.
 * Calls onChunk for each data event.
 * Returns the final parsed result when done.
 */
async function executeSSEStep(
  endpoint: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onChunk: (data: unknown) => void
): Promise<Record<string, unknown> | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
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
