/**
 * useTimeline Hook
 * Real-time timeline data using TanStack Query + Infinite Scroll + Shared SSE
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type {
  CRMTimelineEvent,
  CreateTimelineEventRequest,
  UpdateTimelineEventRequest,
  TimelineFilters,
} from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseTimelineOptions {
  workspaceId: string;
  entityType?: string;
  entityId?: string;
  filters?: TimelineFilters;
  enabled?: boolean;
}

interface UseInfiniteTimelineOptions extends UseTimelineOptions {
  pageSize?: number;
}

/**
 * Fetch timeline events with infinite scroll pagination
 */
export function useInfiniteTimeline({
  workspaceId,
  entityType,
  entityId,
  filters,
  enabled = true,
  pageSize = 20,
}: UseInfiniteTimelineOptions) {
  const queryClient = useQueryClient();

  // Build query params from filters
  const buildParams = (offset: number) => {
    const params = new URLSearchParams({
      workspaceId,
      offset: offset.toString(),
      limit: pageSize.toString(),
    });

    if (entityType) params.set('entityType', entityType);
    if (entityId) params.set('entityId', entityId);
    if (filters?.entityTypes && filters.entityTypes.length > 0) {
      params.set('entityTypes', filters.entityTypes.join(','));
    }
    if (filters?.eventTypes && filters.eventTypes.length > 0) {
      params.set('eventTypes', filters.eventTypes.join(','));
    }
    if (filters?.actorTypes && filters.actorTypes.length > 0) {
      params.set('actorTypes', filters.actorTypes.join(','));
    }
    if (filters?.search) {
      params.set('search', filters.search);
    }
    if (filters?.dateFrom) {
      params.set('dateFrom', filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.set('dateTo', filters.dateTo);
    }

    return params;
  };

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['crm', 'timeline', workspaceId, entityType, entityId, filters],
    queryFn: async ({ pageParam = 0 }) => {
      const params = buildParams(pageParam);
      const response = await fetch(`/api/v1/crm/timeline/events?${params.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch timeline: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      // API returns direct array, not wrapped object
      const events = Array.isArray(data) ? data : (data.events || []);
      return {
        events,
        total: events.length,
      };
    },
    getNextPageParam: (lastPage, pages) => {
      const currentOffset = pages.length * pageSize;
      return lastPage.events.length === pageSize ? currentOffset : undefined;
    },
    initialPageParam: 0,
    enabled: enabled && !!workspaceId,
  });

  // Real-time updates via SSE (prepend new events)
  useSharedSSE({
    table: 'crm_timeline_events',
    queryKey: ['crm', 'timeline', 'recent', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/timeline/recent?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch recent timeline events: ${response.statusText}`);
      }
      const data = await response.json();
      return data.events || [];
    },
    enabled: enabled && !!workspaceId,
    sharedConnection: true,
  });

  return infiniteQuery;
}

/**
 * Get a single timeline event by ID
 */
export function useTimelineEvent(eventId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'timeline', 'event', eventId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/timeline/events/${eventId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch timeline event: ${response.statusText}`);
      }
      return response.json() as Promise<CRMTimelineEvent>;
    },
    enabled: !!eventId && !!workspaceId,
  });
}

/**
 * Create a new timeline event (manual note)
 */
export function useCreateTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTimelineEventRequest) => {
      const response = await fetch(`/api/v1/crm/timeline/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create timeline event');
      }

      return response.json() as Promise<CRMTimelineEvent>;
    },
    onSuccess: (data, variables) => {
      // Invalidate timeline queries
      queryClient.invalidateQueries({
        queryKey: ['crm', 'timeline', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'timeline', 'recent', variables.workspaceId],
      });
    },
  });
}

/**
 * Update a timeline event
 */
export function useUpdateTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      workspaceId,
      data,
    }: {
      eventId: string;
      workspaceId: string;
      data: UpdateTimelineEventRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/timeline/events/${eventId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update timeline event');
      }

      return response.json() as Promise<CRMTimelineEvent>;
    },
    onSuccess: (data, variables) => {
      // Invalidate timeline queries
      queryClient.invalidateQueries({
        queryKey: ['crm', 'timeline', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'timeline', 'event', variables.eventId, variables.workspaceId],
      });
    },
  });
}

/**
 * Delete a timeline event
 */
export function useDeleteTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, workspaceId }: { eventId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/timeline/events/${eventId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete timeline event');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate timeline queries
      queryClient.invalidateQueries({
        queryKey: ['crm', 'timeline', variables.workspaceId],
      });
    },
  });
}
