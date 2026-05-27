/**
 * AgentOS HTTP/SSE Client — simplified for Vercel serverless.
 * Uses native fetch (no node-fetch dependency).
 */
import { config } from '../config';
import { logger } from './logger';

const AGENTOS_BASE = config.agentosUrl;
const AGENTOS_KEY = config.agentosSecurityKey;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (AGENTOS_KEY) {
    headers['Authorization'] = `Bearer ${AGENTOS_KEY}`;
  }
  return headers;
}

export interface AgentOSCallOptions {
  timeoutMs?: number;
  requestId?: string;
  stream?: boolean;
  llmHeaders?: Record<string, string>;
}

/**
 * Start a workflow run via AgentOS native API.
 * Returns the raw Response so callers can choose JSON or SSE consumption.
 */
export async function startWorkflowRun(
  workflowId: string,
  params: Record<string, unknown>,
  opts?: AgentOSCallOptions
): Promise<Response> {
  const url = `${AGENTOS_BASE}/workflows/${workflowId}/runs`;
  const timeoutMs = opts?.timeoutMs ?? 55000; // 55s default (within Vercel 60s)
  const startTime = Date.now();

  // Embed _llm_config directly in the message payload so AgentOS workflow steps
  // can access it via step_input.input["_llm_config"] without relying on middleware
  // body rewriting (which doesn't work with agno's Form-parameter binding).
  const llmHeaders = opts?.llmHeaders || {};
  const messagePayload: Record<string, unknown> = { ...params };
  if (llmHeaders['X-LLM-Api-Key'] && llmHeaders['X-LLM-Base-Url'] && llmHeaders['X-LLM-Model-Id']) {
    messagePayload['_llm_config'] = {
      api_key: llmHeaders['X-LLM-Api-Key'],
      base_url: llmHeaders['X-LLM-Base-Url'],
      model_id: llmHeaders['X-LLM-Model-Id'],
    };
  }

  const formData = new URLSearchParams();
  formData.append('message', JSON.stringify(messagePayload));
  formData.append('stream', opts?.stream ? 'true' : 'false');

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Request-Id': opts?.requestId || '',
    ...authHeaders(),
    ...llmHeaders,
  };

  logger.info({ url, workflowId, requestId: opts?.requestId }, 'Starting AgentOS workflow');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const duration = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, error: errorText, duration, url }, 'AgentOS workflow failed');
      throw new Error(`AGENTOS_${res.status}: ${errorText}`);
    }

    logger.info({ duration, url, streaming: opts?.stream }, 'AgentOS workflow started');
    return res;
  } catch (err: unknown) {
    const duration = Date.now() - startTime;

    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      logger.error({ duration, url, timeoutMs }, 'AgentOS workflow timeout');
      throw new Error('AGENTOS_TIMEOUT');
    }

    logger.error({ err, duration, url }, 'AgentOS workflow error');
    throw err;
  }
}

/**
 * Generic JSON POST to AgentOS custom endpoints.
 */
export async function postAgentOS<T>(
  path: string,
  body: unknown,
  opts?: AgentOSCallOptions
): Promise<T> {
  const url = `${AGENTOS_BASE}${path}`;
  const timeoutMs = opts?.timeoutMs ?? 55000;
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': opts?.requestId || '',
    ...authHeaders(),
    ...(opts?.llmHeaders || {}),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const duration = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, error: errorText, duration, url }, 'AgentOS call failed');
      throw new Error(`AGENTOS_${res.status}: ${errorText}`);
    }

    const result = (await res.json()) as T;
    logger.info({ duration, url }, 'AgentOS call succeeded');
    return result;
  } catch (err: unknown) {
    const duration = Date.now() - startTime;

    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      logger.error({ duration, url }, 'AgentOS call timeout');
      throw new Error('AGENTOS_TIMEOUT');
    }

    logger.error({ err, duration, url }, 'AgentOS call error');
    throw err;
  }
}

/**
 * Generic JSON GET from AgentOS.
 */
export async function getAgentOS<T>(path: string, opts?: AgentOSCallOptions): Promise<T> {
  const url = `${AGENTOS_BASE}${path}`;
  const timeoutMs = opts?.timeoutMs ?? 10000;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(opts?.llmHeaders || {}),
  };

  const res = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AGENTOS_${res.status}: ${errorText}`);
  }

  return (await res.json()) as T;
}

/**
 * Check AgentOS health.
 */
export async function checkAgentOSHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENTOS_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const health = (await res.json()) as { ok?: boolean };
      return health.ok === true;
    }
    return false;
  } catch (err) {
    logger.warn({ err }, 'AgentOS health check failed');
    return false;
  }
}

/**
 * Map AgentOS errors to unified error codes.
 */
export function mapAgentOSError(err: Error): { code: string; retryable: boolean } {
  const msg = err.message;

  if (/AGENTOS_400|AGENTOS_422/.test(msg)) {
    return { code: 'INVALID_INPUT', retryable: false };
  }
  if (/AGENTOS_404/.test(msg)) {
    return { code: 'NOT_FOUND', retryable: false };
  }
  if (/AGENTOS_429/.test(msg)) {
    return { code: 'RATE_LIMITED', retryable: true };
  }
  if (/AGENTOS_TIMEOUT|AGENTOS_5\d\d/.test(msg)) {
    return { code: 'UPSTREAM_TIMEOUT', retryable: true };
  }

  return { code: 'INTERNAL_ERROR', retryable: true };
}

/**
 * Image generation types and function.
 */
export interface ImageGenerationParams {
  prompt: string;
  referenceImages?: string[];
  mode?: 'single' | 'sequence';
  stream?: boolean;
  generationType?: string;
  size?: string;
  watermark?: boolean;
  max_images?: number;
  style?: string;
}

export interface ImageItem {
  url: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  mode: string;
  type: string;
  images: ImageItem[];
}

interface AgentOSImageResponse {
  success: boolean;
  mode?: string;
  type?: string;
  error?: string;
  images?: ImageItem[];
}

export async function runImageGeneration(
  params: ImageGenerationParams,
  opts?: AgentOSCallOptions
): Promise<ImageGenerationResult> {
  const result = await postAgentOS<AgentOSImageResponse>('/api/generate-image', {
    prompt: params.prompt,
    reference_images: params.referenceImages || [],
    mode: params.mode || 'single',
    stream: params.stream || false,
    generation_type: params.generationType,
    size: params.size || '2K',
    watermark: params.watermark || false,
    max_images: params.max_images || 3,
  }, opts);

  if (!result.success) {
    throw new Error(result.error || 'Image generation failed');
  }

  return {
    success: result.success,
    mode: result.mode || 'single',
    type: result.type || 'auto',
    images: (result.images || []).map((img) => ({
      url: img.url,
      width: img.width,
      height: img.height,
    })),
  };
}
