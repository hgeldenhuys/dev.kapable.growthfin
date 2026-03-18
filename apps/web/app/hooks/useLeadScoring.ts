/**
 * useLeadScoring Hooks
 * Hooks for fetching and managing lead scoring data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';


export interface LeadScores {
  leadId: string;
  scores: {
    propensity: number;
    engagement: number;
    fit: number;
    composite: number;
  };
  breakdown: {
    engagement: {
      email_opens: number;
      email_clicks: number;
      website_visits: number;
      activities: number;
      total: number;
    };
    fit: {
      company_size_match: number;
      industry_match: number;
      revenue_match: number;
      geo_match: number;
      total: number;
    };
  };
  calculated_at: string;
  history: Array<{
    date: string;
    composite: number;
  }>;
}

export interface ScoringModel {
  id: string;
  workspace_id: string;
  name: string;
  model_type: string;
  propensity_weight: number;
  engagement_weight: number;
  fit_weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch lead scores for a specific lead
 */
export function useLeadScores(leadId: string | null, workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', leadId, 'scores'],
    queryFn: async () => {
      if (!leadId) return null;

      const response = await fetch(
        `/api/v1/crm/scoring/leads/${leadId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch lead scores');
      }

      return response.json() as Promise<LeadScores>;
    },
    enabled: !!leadId && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Fetch scoring models for workspace
 */
export function useScoringModels(workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'scoring-models'],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/scoring/models?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch scoring models');
      }

      return response.json() as Promise<{ models: ScoringModel[] }>;
    },
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Update scoring model configuration
 */
export function useUpdateScoringModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      modelId,
      data,
    }: {
      workspaceId: string;
      modelId: string;
      data: {
        propensity_weight?: number;
        engagement_weight?: number;
        fit_weight?: number;
      };
    }) => {
      const response = await fetch(
        `/api/v1/crm/scoring/models/${modelId}?workspaceId=${workspaceId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update scoring model');
      }

      return response.json();
    },
    onSuccess: (_data: any, { workspaceId }: { workspaceId: string }) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'scoring-models'],
      });
      // Invalidate all lead scores as they may have changed
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'leads'],
      });
    },
  });
}

/**
 * Trigger manual score recalculation for a lead
 */
export function useRecalculateScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      leadId,
    }: {
      workspaceId: string;
      leadId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/scoring/leads/${leadId}/recalculate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to recalculate scores');
      }

      return response.json();
    },
    onSuccess: (_data: any, { workspaceId, leadId }: { workspaceId: string; leadId: string }) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'leads', leadId, 'scores'],
      });
    },
  });
}

/**
 * Subscribe to lead score updates via SSE
 */
export function useLeadScoreUpdates(leadId: string | null, workspaceId: string) {
  // This would be implemented with SSE connection
  // For now, we'll use polling as a fallback
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', leadId, 'scores', 'stream'],
    queryFn: async () => {
      // SSE implementation would go here
      // For now, return null to indicate streaming not yet implemented
      return null;
    },
    enabled: false, // Disable until SSE is implemented
    refetchInterval: 30000, // Fallback: Poll every 30 seconds
  });
}
