/**
 * useAIConfig Hook
 * Query hook for workspace AI configuration status
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAIConfig } from '../../lib/api/ai-assistant';

export interface AIConfig {
  id: string;
  workspaceId: string;
  apiKey?: string; // Never returned
  hasApiKey: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useAIConfig(workspaceId: string) {
  return useQuery<AIConfig>({
    queryKey: ['ai-config', workspaceId],
    queryFn: () => fetchAIConfig(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if not configured
  });
}
