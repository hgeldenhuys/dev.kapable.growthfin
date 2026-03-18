/**
 * useLeadScoreHistory Hook
 * Fetch lead score history for trend chart display
 */

import { useQuery } from '@tanstack/react-query';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface LeadScoreHistoryEntry {
  id: string;
  scoreBefore: number | null;
  scoreAfter: number;
  scoreDelta: number;
  createdAt: string;
  triggerType: string;
  triggerReason: string | null;
}

interface UseLeadScoreHistoryOptions {
  leadId: string | null;
  workspaceId: string;
  days?: number; // Number of days to fetch (default: 7)
  enabled?: boolean;
}

/**
 * Fetch lead score history
 */
export function useLeadScoreHistory({
  leadId,
  workspaceId,
  days = 7,
  enabled = true
}: UseLeadScoreHistoryOptions) {
  return useQuery({
    queryKey: ['crm', 'lead', leadId, 'score-history', days],
    queryFn: async () => {
      if (!leadId) {
        return { history: [] };
      }

      const params = new URLSearchParams();
      params.set('workspaceId', workspaceId);
      params.set('days', days.toString());

      const url = `/api/v1/crm/leads/${leadId}/score-history?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch score history');
      }

      return response.json() as Promise<{ history: LeadScoreHistoryEntry[] }>;
    },
    enabled: enabled && !!leadId && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
