/**
 * useEnrichment Hook
 * React Query hooks for enrichment job API operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type {
  EnrichmentJob,
  EnrichmentJobWithResults,
  EnrichmentResult,
  CreateEnrichmentJobRequest,
  ContactList,
} from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseEnrichmentJobsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * List enrichment jobs with real-time SSE updates
 */
export function useEnrichmentJobs({ workspaceId, enabled = true }: UseEnrichmentJobsOptions) {
  return useSharedSSE({
    table: 'crm_enrichment_jobs',
    queryKey: ['crm', 'enrichment', 'jobs', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch enrichment jobs: ${response.statusText}`);
      }
      const data = await response.json();
      return data.jobs || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single enrichment job with results
 */
export function useEnrichmentJob(jobId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'enrichment', 'jobs', jobId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs/${jobId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch enrichment job: ${response.statusText}`);
      }
      return response.json() as Promise<EnrichmentJobWithResults>;
    },
    enabled: !!jobId && !!workspaceId,
  });
}

/**
 * Get contact lists for workspace (optionally filtered by entity type)
 */
export function useContactLists(workspaceId: string, entityType?: string) {
  return useQuery({
    queryKey: ['crm', 'lists', workspaceId, entityType || 'all'],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
      });

      // Only add entityType if provided (undefined means get all lists)
      if (entityType) {
        params.append('entityType', entityType);
      }

      const response = await fetch(
        `/api/v1/crm/lists?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch contact lists: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.lists || []) as ContactList[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Get a single contact list by ID
 */
export function useContactList(listId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'lists', listId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/lists/${listId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch contact list: ${response.statusText}`);
      }
      const data = await response.json();
      return data.list as ContactList;
    },
    enabled: !!listId && !!workspaceId,
  });
}

/**
 * Get list members (contacts in a list) with optional custom field filtering
 */
export function useListMembers(
  listId: string,
  workspaceId: string,
  customFieldFilters?: Record<string, any>
) {
  return useQuery({
    queryKey: ['crm', 'lists', listId, 'members', workspaceId, customFieldFilters],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });

      // Add custom field filters to query params
      if (customFieldFilters) {
        for (const [key, value] of Object.entries(customFieldFilters)) {
          if (value !== null && value !== 'all' && value !== undefined) {
            params.append(`customField.${key}`, String(value));
          }
        }
      }

      const response = await fetch(
        `/api/v1/crm/lists/${listId}/members?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch list members: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        members: data.members || [],
        customFieldSchema: data.customFieldSchema || {}
      };
    },
    enabled: !!listId && !!workspaceId,
  });
}

/**
 * Create a new contact list
 */
export function useCreateContactList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      name: string;
      description?: string | null;
      type?: 'manual' | 'import' | 'campaign' | 'enrichment' | 'segment';
      entityType?: 'lead' | 'contact' | 'account' | 'opportunity';
    }) => {
      // Default entityType to 'contact' for backward compatibility
      const payload = {
        ...data,
        entityType: data.entityType || 'contact',
      };
      const response = await fetch(`/api/v1/crm/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create contact list');
      }

      return response.json() as Promise<ContactList>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', variables.workspaceId],
      });
    },
  });
}

/**
 * Update a contact list
 */
export function useUpdateContactList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      listId: string;
      workspaceId: string;
      name?: string;
      description?: string | null;
      status?: string;
      budgetLimit?: string | null;
    }) => {
      const { listId, workspaceId, ...updateData } = data;

      // Filter out null values to avoid API validation errors
      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== null)
      );

      const response = await fetch(
        `/api/v1/crm/lists/${listId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanedData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update contact list');
      }

      return response.json() as Promise<ContactList>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', variables.listId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', variables.workspaceId],
      });
    },
  });
}

/**
 * Delete a contact list
 */
export function useDeleteContactList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, workspaceId }: { listId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/lists/${listId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete contact list');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', variables.workspaceId],
      });
    },
  });
}

/**
 * Remove contact from list
 */
export function useRemoveContactFromList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      memberId,
      workspaceId,
    }: {
      listId: string;
      memberId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/lists/${listId}/members/${memberId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to remove member from list');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', variables.listId, 'members', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', variables.listId, variables.workspaceId],
      });
    },
  });
}

/**
 * Create a new enrichment job
 */
export function useCreateEnrichmentJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEnrichmentJobRequest) => {
      const response = await fetch(`/api/v1/crm/enrichment/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create enrichment job');
      }

      return response.json() as Promise<EnrichmentJob>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.workspaceId],
      });
    },
  });
}

/**
 * Run sample mode on job
 */
export function useRunSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, workspaceId }: { jobId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs/${jobId}/sample?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to run sample');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.jobId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.workspaceId],
      });
    },
  });
}

/**
 * Run batch mode on job
 */
export function useRunBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, workspaceId }: { jobId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs/${jobId}/batch?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to run batch');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.jobId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.workspaceId],
      });
    },
  });
}

/**
 * Cancel a running job
 */
export function useCancelEnrichmentJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, workspaceId }: { jobId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs/${jobId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to cancel job');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.jobId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', variables.workspaceId],
      });
    },
  });
}

/**
 * Real-time progress hook using SSE
 */
export function useEnrichmentJobProgress(jobId: string, workspaceId: string) {
  return useSharedSSE({
    table: 'crm_enrichment_jobs',
    queryKey: ['crm', 'enrichment', 'jobs', 'progress', jobId, workspaceId],
    where: `id = '${jobId}' AND workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs/${jobId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch job progress: ${response.statusText}`);
      }
      const data = await response.json();
      return [data];
    },
    enabled: !!jobId && !!workspaceId,
  });
}

/**
 * Get enrichment results for a job
 */
export function useEnrichmentResults(jobId: string, workspaceId: string) {
  return useSharedSSE({
    table: 'crm_enrichment_results',
    queryKey: ['crm', 'enrichment', 'results', jobId, workspaceId],
    where: `job_id = '${jobId}' AND workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/enrichment/jobs/${jobId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch enrichment results: ${response.statusText}`);
      }
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!jobId && !!workspaceId,
  });
}
