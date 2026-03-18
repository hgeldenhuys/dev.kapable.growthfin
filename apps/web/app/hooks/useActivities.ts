/**
 * useActivities Hook
 * Real-time activities data using TanStack Query + Shared SSE
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type { Activity, CreateActivityRequest, UpdateActivityRequest } from '~/types/crm';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseActivitiesOptions {
  workspaceId: string;
  enabled?: boolean;
  filters?: {
    activityType?: string;
    status?: string;
    priority?: string;
    relatedToType?: string;
    relatedToId?: string;
  };
}

/**
 * Fetch activities with real-time SSE updates
 */
export function useActivities({ workspaceId, enabled = true, filters }: UseActivitiesOptions) {
  return useSharedSSE({
    table: 'crm_activities',
    queryKey: ['crm', 'activities', 'recent', workspaceId, filters],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const params = new URLSearchParams({ workspaceId });
      if (filters?.activityType) params.append('type', filters.activityType);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.relatedToType) params.append('relatedToType', filters.relatedToType);
      if (filters?.relatedToId) params.append('relatedToId', filters.relatedToId);

      const response = await fetch(
        `/api/v1/crm/activities/recent?${params.toString()}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch activities: ${errorText || response.statusText}`);
      }
      const data = await response.json();
      return data.activities || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single activity by ID
 */
export function useActivity(activityId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'activities', activityId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/activities/${activityId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: `Failed to fetch activity: ${errorText || response.statusText}` });
        throw new Error(`Failed to fetch activity: ${errorText || response.statusText}`);
      }
      return response.json() as Promise<Activity>;
    },
    enabled: !!activityId && !!workspaceId,
  });
}

/**
 * Create a new activity
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateActivityRequest) => {
      const response = await fetch(`/api/v1/crm/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to create activity' });
        throw new Error(error || 'Failed to create activity');
      }

      return response.json() as Promise<Activity>;
    },
    onSuccess: (data, variables) => {
      // Invalidate activities list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', 'recent', variables.workspaceId]
      });
      toast.success('Success', { description: 'Activity created successfully' });
    },
  });
}

/**
 * Update an activity
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      activityId,
      workspaceId,
      data,
    }: {
      activityId: string;
      workspaceId: string;
      data: UpdateActivityRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/activities/${activityId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to update activity' });
        throw new Error(error || 'Failed to update activity');
      }

      return response.json() as Promise<Activity>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', variables.activityId, variables.workspaceId]
      });
      toast.success('Success', { description: 'Activity updated successfully' });
    },
  });
}

/**
 * Complete an activity
 */
export function useCompleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, workspaceId, userId }: { activityId: string; workspaceId: string; userId: string }) => {
      const response = await fetch(
        `/api/v1/crm/activities/${activityId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            completedDate: new Date().toISOString(),
            updatedBy: userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to complete activity' });
        throw new Error(error || 'Failed to complete activity');
      }

      return response.json() as Promise<Activity>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', variables.activityId, variables.workspaceId]
      });
      toast.success('Success', { description: 'Activity completed' });
    },
  });
}

/**
 * Cancel an activity
 */
export function useCancelActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, workspaceId, userId }: { activityId: string; workspaceId: string; userId: string }) => {
      const response = await fetch(
        `/api/v1/crm/activities/${activityId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
            updatedBy: userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to cancel activity' });
        throw new Error(error || 'Failed to cancel activity');
      }

      return response.json() as Promise<Activity>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', variables.activityId, variables.workspaceId]
      });
      toast.success('Success', { description: 'Activity cancelled' });
    },
  });
}

/**
 * Delete an activity
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, workspaceId }: { activityId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/activities/${activityId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to delete activity' });
        throw new Error(error || 'Failed to delete activity');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', 'recent', variables.workspaceId]
      });
      toast.success('Success', { description: 'Activity deleted' });
    },
  });
}
