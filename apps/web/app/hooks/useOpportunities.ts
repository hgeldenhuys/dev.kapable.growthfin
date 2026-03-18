/**
 * useOpportunities Hook
 * Real-time opportunities data using TanStack Query + Shared SSE
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type {
  Opportunity,
  CreateOpportunityRequest,
  UpdateOpportunityRequest,
  CloseOpportunityRequest
} from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseOpportunitiesOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch opportunities with real-time SSE updates
 */
export function useOpportunities({ workspaceId, enabled = true }: UseOpportunitiesOptions) {
  return useSharedSSE({
    table: 'crm_opportunities',
    queryKey: ['crm', 'opportunities', 'recent', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      // Use a large window (1 year) to ensure all pipeline opportunities are shown
      const response = await fetch(
        `/api/v1/crm/opportunities/recent?workspaceId=${workspaceId}&seconds=31536000`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch opportunities: ${errorText}`);
      }
      const data = await response.json();
      return data.opportunities || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single opportunity by ID
 */
export function useOpportunity(opportunityId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'opportunities', opportunityId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/opportunities/${opportunityId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch opportunity: ${errorText}`);
      }
      return response.json() as Promise<Opportunity>;
    },
    enabled: !!opportunityId && !!workspaceId,
  });
}

/**
 * Create a new opportunity
 */
export function useCreateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOpportunityRequest) => {
      const response = await fetch(`/api/v1/crm/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create opportunity');
      }

      return response.json() as Promise<Opportunity>;
    },
    onSuccess: (data, variables) => {
      // Invalidate opportunities list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', 'recent', variables.workspaceId]
      });
    },
  });
}

/**
 * Update an opportunity
 */
export function useUpdateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      workspaceId,
      data,
    }: {
      opportunityId: string;
      workspaceId: string;
      data: UpdateOpportunityRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/opportunities/${opportunityId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update opportunity');
      }

      return response.json() as Promise<Opportunity>;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific opportunity
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', variables.opportunityId, variables.workspaceId]
      });
    },
  });
}

/**
 * Delete an opportunity
 */
export function useDeleteOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, workspaceId }: { opportunityId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/opportunities/${opportunityId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete opportunity');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', 'recent', variables.workspaceId]
      });
    },
  });
}

/**
 * Change opportunity stage (special update for drag-and-drop)
 */
export function useChangeOpportunityStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      workspaceId,
      stage,
      probability,
      updatedById,
    }: {
      opportunityId: string;
      workspaceId: string;
      stage: string;
      probability: number;
      updatedById?: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/opportunities/${opportunityId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage,
            probability,
            ...(updatedById && { updatedById }),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to change opportunity stage');
      }

      return response.json() as Promise<Opportunity>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', variables.opportunityId, variables.workspaceId]
      });
    },
  });
}

/**
 * Close opportunity as won or lost
 */
export function useCloseOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      data,
    }: {
      opportunityId: string;
      data: CloseOpportunityRequest;
    }) => {
      const stage = data.status === 'won' ? 'closed_won' : 'closed_lost';
      const updateData: UpdateOpportunityRequest = {
        status: data.status,
        stage: stage as any,
        winLossReason: data.winLossReason,
        actualCloseDate: data.actualCloseDate || new Date().toISOString().split('T')[0],
        probability: data.status === 'won' ? 100 : 0,
      };

      if (data.amount) {
        updateData.amount = data.amount;
      }

      const response = await fetch(
        `/api/v1/crm/opportunities/${opportunityId}?workspaceId=${data.workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to close opportunity');
      }

      return response.json() as Promise<Opportunity>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', 'recent', variables.data.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunities', variables.opportunityId, variables.data.workspaceId]
      });
    },
  });
}
