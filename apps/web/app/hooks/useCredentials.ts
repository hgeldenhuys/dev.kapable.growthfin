/**
 * TanStack Query hook for fetching available LLM credentials
 */

import { useQuery } from '@tanstack/react-query';

interface Credential {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  modelCount: number;
}

interface CredentialsResponse {
  credentials: Credential[];
}

export function useCredentials() {
  return useQuery({
    queryKey: ['assistant-credentials'],
    queryFn: async (): Promise<Credential[]> => {
      const response = await fetch('/api/v1/assistant/credentials');

      if (!response.ok) {
        throw new Error(`Failed to fetch credentials: ${response.statusText}`);
      }

      const data: CredentialsResponse = await response.json();
      return data.credentials;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - credentials don't change often
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
