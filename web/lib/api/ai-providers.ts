import { api } from './client';

export interface AIProvider {
  name: string;
  display_name: string;
  available: boolean;
  model: string;
  active: boolean;
}

export interface AIProvidersResponse {
  success: boolean;
  providers: AIProvider[];
  current: string;
}

export interface AIProviderConfig {
  provider: string;
  model_id: string;
  api_key: string;
  base_url?: string;
}

export interface CurrentProviderResponse {
  success: boolean;
  config: AIProviderConfig;
}

export interface SwitchProviderResponse {
  success: boolean;
  message: string;
  config: AIProviderConfig;
  note: string;
}

/**
 * Get list of available AI providers
 */
export async function getAIProviders(): Promise<AIProvidersResponse> {
  return api<AIProvidersResponse>('/api/ai/providers', {
    method: 'GET',
  });
}

/**
 * Get current AI provider configuration
 */
export async function getCurrentProvider(): Promise<CurrentProviderResponse> {
  return api<CurrentProviderResponse>('/api/ai/provider', {
    method: 'GET',
  });
}

/**
 * Switch AI provider
 */
export async function switchAIProvider(provider: 'openai' | 'hunyuan'): Promise<SwitchProviderResponse> {
  return api<SwitchProviderResponse>('/api/ai/provider', {
    method: 'POST',
    body: { provider },
  });
}

