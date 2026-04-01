import { api } from './client';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

export type LLMConfigType = 'TEXT_LLM' | 'IMAGE_GEN';

export interface LLMConfig {
  id: string;
  name: string;
  type: LLMConfigType;
  baseUrl: string;
  apiKey: string; // masked by backend, e.g. "sk-***...xyz"
  modelId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLLMConfigInput {
  name: string;
  type: LLMConfigType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault?: boolean;
}

export interface UpdateLLMConfigInput {
  name?: string;
  type?: LLMConfigType;
  baseUrl?: string;
  apiKey?: string;
  modelId?: string;
  isDefault?: boolean;
}

export interface VerifyResult {
  success: boolean;
  model?: string;
  latencyMs?: number;
  error?: string;
}

// ────────────────────────────────────────────────────────
// API Functions
// ────────────────────────────────────────────────────────

/** List all LLM configs for the current user */
export async function listLLMConfigs(): Promise<LLMConfig[]> {
  const res = await api<{ data: LLMConfig[] }>('/api/llm-configs', {
    method: 'GET',
  });
  return res.data ?? [];
}

/** Create a new LLM config */
export async function createLLMConfig(input: CreateLLMConfigInput): Promise<LLMConfig> {
  return api<LLMConfig>('/api/llm-configs', {
    method: 'POST',
    body: input,
  });
}

/** Update an existing LLM config */
export async function updateLLMConfig(id: string, input: UpdateLLMConfigInput): Promise<LLMConfig> {
  return api<LLMConfig>(`/api/llm-configs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
}

/** Delete an LLM config */
export async function deleteLLMConfig(id: string): Promise<void> {
  await api<{ success: boolean }>(`/api/llm-configs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Set a config as default for its type */
export async function setDefaultLLMConfig(id: string): Promise<LLMConfig> {
  return api<LLMConfig>(`/api/llm-configs/${encodeURIComponent(id)}/set-default`, {
    method: 'POST',
  });
}

/** Verify an LLM config by testing the connection */
export async function verifyLLMConfig(input: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  type?: LLMConfigType;
}): Promise<VerifyResult> {
  return api<VerifyResult>('/api/llm-configs/verify', {
    method: 'POST',
    body: input,
    timeoutMs: 15000,
  });
}
