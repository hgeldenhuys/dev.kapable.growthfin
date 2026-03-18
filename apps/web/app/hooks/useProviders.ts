/**
 * TanStack Query hook for fetching available providers
 */

import { useQuery } from '@tanstack/react-query';

interface Provider {
  name: string;
  displayName: string;
  modelCount: number;
}

export function useProviders() {
  return useQuery({
    queryKey: ['model-catalog-providers'],
    queryFn: async (): Promise<Provider[]> => {
      const response = await fetch('/api/v1/model-catalog/providers');

      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.statusText}`);
      }

      const data = await response.json();
      return data.providers;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - providers don't change often
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
