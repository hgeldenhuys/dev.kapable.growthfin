/**
 * LLM Credentials Types
 */

export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  TOGETHER: 'together',
  OPENROUTER: 'openrouter',
  OPENAPI: 'openapi',
} as const;

export type LLMProvider = typeof LLM_PROVIDERS[keyof typeof LLM_PROVIDERS];

export interface LLMCredential {
  id: string;
  name: string;
  provider: LLMProvider;
  workspaceId: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCredentialDto {
  name: string;
  provider: LLMProvider;
  apiKey: string; // Plain text - will be encrypted by backend
  workspaceId?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

export interface UpdateCredentialDto {
  name?: string;
  provider?: LLMProvider;
  apiKey?: string; // Optional - only if rotating key
  workspaceId?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

export const PROVIDER_OPTIONS = [
  {
    label: 'OpenRouter',
    value: LLM_PROVIDERS.OPENROUTER,
    description: 'Access 200+ models from OpenAI, Anthropic, Meta, Google, and more',
  },
  {
    label: 'OpenAI',
    value: LLM_PROVIDERS.OPENAI,
    description: 'GPT-3.5, GPT-4, GPT-4 Turbo',
  },
  {
    label: 'Anthropic',
    value: LLM_PROVIDERS.ANTHROPIC,
    description: 'Claude 3 (Opus, Sonnet, Haiku)',
  },
  {
    label: 'Together AI',
    value: LLM_PROVIDERS.TOGETHER,
    description: 'Meta Llama, Mixtral, and more',
  },
  {
    label: 'Custom OpenAPI',
    value: LLM_PROVIDERS.OPENAPI,
    description: 'Any OpenAPI-compatible endpoint',
  },
];

export const PROVIDER_ICONS: Record<LLMProvider, string> = {
  openrouter: '🌐',
  openai: '🤖',
  anthropic: '🧠',
  together: '🔗',
  openapi: '🔌',
};
