/**
 * TanStack Query hook for fetching providers filtered by credential
 */

import { useQuery } from '@tanstack/react-query';

interface Provider {
  provider: string;
  modelCount: number;
}

interface ProvidersResponse {
  providers: Provider[];
}

export function useProvidersByCredential(credentialId: string | null) {
  return useQuery({
    queryKey: ['assistant-credential-providers', credentialId],
    queryFn: async (): Promise<Provider[]> => {
      if (!credentialId) {
        return [];
      }

      const response = await fetch(`/api/v1/assistant/credentials/${credentialId}/providers`);

      if (!response.ok) {
        throw new Error(`Failed to fetch providers for credential: ${response.statusText}`);
      }

      const data: ProvidersResponse = await response.json();
      return data.providers;
    },
    enabled: !!credentialId, // Only run query when credential is selected
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}
