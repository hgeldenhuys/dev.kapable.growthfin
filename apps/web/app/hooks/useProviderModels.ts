/**
 * TanStack Query hook for fetching models by provider
 */

import { useQuery } from '@tanstack/react-query';

interface Model {
  id: string;
  modelName: string;
  displayName: string;
  inputCostPer1MTokens: string;
  outputCostPer1MTokens: string;
  contextWindow: number;
  provider: string;
  isActive: boolean;
}

export function useProviderModels(provider: string | null) {
  return useQuery({
    queryKey: ['model-catalog-provider-models', provider],
    queryFn: async (): Promise<Model[]> => {
      if (!provider) {
        return [];
      }

      const response = await fetch(`/api/v1/model-catalog/providers/${provider}/models`);

      if (!response.ok) {
        throw new Error(`Failed to fetch models for ${provider}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models;
    },
    enabled: !!provider, // Only run query when provider is selected
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}
