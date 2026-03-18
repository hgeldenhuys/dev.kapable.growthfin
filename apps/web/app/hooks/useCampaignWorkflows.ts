/**
 * useCampaignWorkflows Hook
 * React Query hooks for campaign workflow management with CQRS pattern
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { useEffect } from 'react';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

// Types
export interface WorkflowStep {
  id: string;
  type: 'send_campaign' | 'wait' | 'condition' | 'update_lead_field' | 'add_tag' | 'remove_tag' | 'send_notification';
  name: string;
  config: any; // Step-specific configuration
  transitions: Transition[];
}

export interface Transition {
  to: string; // Next step ID
  condition?: any; // Optional condition for branching
  label?: string;
}

export interface CampaignWorkflow {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  tags: string[];
  steps: WorkflowStep[];
  entryConditions?: any;
  exitConditions?: any;
  status: 'draft' | 'active' | 'paused' | 'archived';
  enrollmentCount: number;
  activeEnrollmentCount: number;
  completionRate: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateWorkflowRequest {
  workspaceId: string;
  name: string;
  description?: string;
  tags?: string[];
  steps: WorkflowStep[];
  entryConditions?: any;
  exitConditions?: any;
}

interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  tags?: string[];
  steps?: WorkflowStep[];
  entryConditions?: any;
  exitConditions?: any;
}

interface ListWorkflowsOptions {
  workspaceId: string;
  status?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Get recent workflows (CQRS pattern - initial state)
 */
export function useRecentWorkflows(workspaceId: string, seconds = 86400) {
  return useQuery({
    queryKey: ['crm', 'campaign-workflows', 'recent', workspaceId, seconds],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/recent?workspaceId=${workspaceId}&seconds=${seconds}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch recent workflows: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : data?.workflows ?? []) as CampaignWorkflow[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Real-time SSE stream for workflow updates
 */
export function useWorkflowStream(workspaceId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const eventSource = new EventSource(
      `/api/v1/crm/campaign-workflows/stream?workspaceId=${workspaceId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        // Invalidate relevant queries to trigger refetch
        queryClient.invalidateQueries({
          queryKey: ['crm', 'campaign-workflows', 'list', workspaceId],
        });
        queryClient.invalidateQueries({
          queryKey: ['crm', 'campaign-workflows', 'recent', workspaceId],
        });
        if (update.workflowId) {
          queryClient.invalidateQueries({
            queryKey: ['crm', 'campaign-workflows', 'detail', update.workflowId, workspaceId],
          });
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [workspaceId, queryClient]);
}

/**
 * List workflows with filters
 */
export function useWorkflows(options: ListWorkflowsOptions) {
  const { workspaceId, status, tags, limit = 50, offset = 0 } = options;

  return useQuery({
    queryKey: ['crm', 'campaign-workflows', 'list', workspaceId, status, tags, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        ...(status && { status }),
        ...(tags && tags.length > 0 && { tags: JSON.stringify(tags) }),
        limit: String(limit),
        offset: String(offset),
      });

      const response = await apiRequest(`/api/v1/crm/campaign-workflows?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : data?.workflows ?? []) as CampaignWorkflow[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Get single workflow by ID
 */
export function useWorkflow(workflowId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaign-workflows', 'detail', workflowId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${workflowId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow: ${response.statusText}`);
      }
      return response.json() as Promise<CampaignWorkflow>;
    },
    enabled: !!workflowId && !!workspaceId,
  });
}

/**
 * Create a new workflow
 */
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWorkflowRequest) => {
      const response = await apiRequest(`/api/v1/crm/campaign-workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create workflow');
      }

      return response.json() as Promise<CampaignWorkflow>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'recent', variables.workspaceId],
      });
    },
  });
}

/**
 * Update a workflow
 */
export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workflowId,
      workspaceId,
      data,
    }: {
      workflowId: string;
      workspaceId: string;
      data: UpdateWorkflowRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${workflowId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update workflow');
      }

      return response.json() as Promise<CampaignWorkflow>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'detail', variables.workflowId, variables.workspaceId],
      });
    },
  });
}

/**
 * Activate a workflow
 */
export function useActivateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId, workspaceId }: { workflowId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${workflowId}/activate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to activate workflow');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'detail', variables.workflowId, variables.workspaceId],
      });
    },
  });
}

/**
 * Pause a workflow
 */
export function usePauseWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId, workspaceId }: { workflowId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${workflowId}/pause?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to pause workflow');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'detail', variables.workflowId, variables.workspaceId],
      });
    },
  });
}

/**
 * Delete (soft delete) a workflow
 */
export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId, workspaceId }: { workflowId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${workflowId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete workflow');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'recent', variables.workspaceId],
      });
    },
  });
}
