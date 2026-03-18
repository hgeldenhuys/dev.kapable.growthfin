/**
 * useLLMConfigs Hook
 * Hook for fetching LLM configurations
 */

import { useQuery } from '@tanstack/react-query';

export interface LLMConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  systemPrompt: string | null;
  temperature: number;
  maxTokens: number;
  apiUrl: string | null;
  credentialId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LLMConfigsResponse {
  configs: LLMConfig[];
}

/**
 * Fetch all LLM configurations
 */
export function useLLMConfigs() {
  return useQuery({
    queryKey: ['llm-configs'],
    queryFn: async () => {
      const response = await fetch('/api/v1/llm-configs');

      if (!response.ok) {
        throw new Error(`Failed to fetch LLM configs: ${response.statusText}`);
      }

      const data = (await response.json()) as LLMConfigsResponse;
      return data.configs;
    },
  });
}

/**
 * Get active LLM configs only
 */
export function useActiveLLMConfigs() {
  const { data, ...rest } = useLLMConfigs();

  return {
    ...rest,
    data: data?.filter((config) => config.isActive) || [],
  };
}
