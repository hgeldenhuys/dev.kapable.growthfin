/**
 * TanStack Query hook for fetching models filtered by credential and provider
 */

import { useQuery } from '@tanstack/react-query';

interface Model {
  id: string;
  provider: string;
  modelName: string;
  displayName: string;
  inputCostPer1MTokens: string;
  outputCostPer1MTokens: string;
  contextWindow: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

interface ModelsResponse {
  models: Model[];
}

export function useModelsByCredentialAndProvider(
  credentialId: string | null,
  provider: string | null
) {
  return useQuery({
    queryKey: ['assistant-credential-provider-models', credentialId, provider],
    queryFn: async (): Promise<Model[]> => {
      if (!credentialId || !provider) {
        return [];
      }

      const response = await fetch(
        `/api/v1/assistant/credentials/${credentialId}/providers/${provider}/models`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data: ModelsResponse = await response.json();
      return data.models;
    },
    enabled: !!credentialId && !!provider, // Only run when both credential and provider are selected
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}
