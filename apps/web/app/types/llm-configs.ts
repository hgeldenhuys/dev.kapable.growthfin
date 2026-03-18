/**
 * LLM Configuration Types
 */

import type { LLMProvider } from './credentials';

export interface LLMConfig {
  id: string;
  name: string;
  provider: LLMProvider;
  model: string;
  systemPrompt: string;
  temperature: number; // 0-100 (stored as int, displayed as 0.0-1.0)
  maxTokens: number;
  apiUrl: string | null; // For OpenAPI provider
  credentialId: string;
  projectId: string | null; // null = global
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  credential?: {
    id: string;
    name: string;
    provider: LLMProvider;
  };
}

export interface CreateLLMConfigDto {
  name: string;
  provider: LLMProvider;
  model: string;
  systemPrompt: string;
  temperature?: number; // 0-100
  maxTokens?: number;
  apiUrl?: string | null;
  credentialId: string;
  projectId?: string | null;
  isActive?: boolean;
}

export interface UpdateLLMConfigDto {
  name?: string;
  provider?: LLMProvider;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  apiUrl?: string | null;
  credentialId?: string;
  projectId?: string | null;
  isActive?: boolean;
}

export interface DefaultPrompts {
  prompts: Record<string, string>;
}

export interface ModelCatalogEntry {
  id: string;
  provider: LLMProvider;
  modelName: string;
  displayName: string;
  inputCostPer1MTokens: string;
  outputCostPer1MTokens: string;
  contextWindow: number | null;
  isActive: boolean;
  metadata: any;
}

// Common models for each provider
export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  openai: [
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ],
  anthropic: [
    'claude-haiku-4.5',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  together: [
    'meta-llama/Llama-3-70b-chat-hf',
    'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
  ],
  openapi: [], // Custom models via apiUrl
};
