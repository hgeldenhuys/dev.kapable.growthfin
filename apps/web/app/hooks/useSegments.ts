/**
 * useSegments Hook
 * TanStack Query hooks for lead segments
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { useSharedSSE } from './useSharedSSE';


interface Segment {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  criteria: Record<string, any>;
  autoRefresh: boolean;
  refreshIntervalMinutes: number;
  lastRefreshedAt?: string;
  memberCount: number;
  lastMemberCount?: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  deletedAt?: string;
  metrics?: {
    totalLeads: number;
    newLeads7d: number;
    conversionRate: number;
    avgPropensityScore: number;
    avgEngagementScore: number;
    avgFitScore: number;
    avgCompositeScore: number;
    activityVolume30d: number;
  };
}

interface CreateSegmentRequest {
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  criteria: Record<string, any>;
  autoRefresh?: boolean;
  refreshIntervalMinutes?: number;
}

interface UpdateSegmentRequest extends CreateSegmentRequest {
  segmentId: string;
}

interface UseSegmentsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch all segments with real-time updates
 */
export function useSegments({ workspaceId, enabled = true }: UseSegmentsOptions) {
  return useSharedSSE<Segment[]>({
    table: 'lead_segments',
    queryKey: ['workspaces', workspaceId, 'leads', 'segments'],
    where: `workspace_id = '${workspaceId}' AND deleted_at IS NULL`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/segments?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch segments: ${response.statusText}`);
      }
      const data = await response.json();
      return data.segments || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single segment by ID
 */
export function useSegment(segmentId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', 'segments', segmentId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/segments/${segmentId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch segment: ${response.statusText}`);
      }
      return response.json() as Promise<Segment>;
    },
    enabled: !!segmentId && !!workspaceId,
  });
}

/**
 * Get segment metrics
 */
export function useSegmentMetrics(segmentId: string, workspaceId: string, timeframe: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', 'segments', segmentId, 'metrics', timeframe],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/segments/${segmentId}/metrics?workspaceId=${workspaceId}&timeframe=${timeframe}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch segment metrics: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!segmentId && !!workspaceId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Preview segment (get matching lead count)
 */
export function useSegmentPreview(criteria: Record<string, any>, workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', 'segments', 'preview', criteria],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/segments/preview?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to preview segment: ${response.statusText}`);
      }
      return response.json() as Promise<{ matchingLeads: number; sampleLeads: any[] }>;
    },
    enabled: !!workspaceId && Object.keys(criteria).length > 0,
    // Debounce preview updates
    staleTime: 500,
  });
}

/**
 * Create a new segment
 */
export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSegmentRequest) => {
      const response = await fetch(
        `/api/v1/crm/segments?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            color: data.color,
            criteria: data.criteria,
            auto_refresh: data.autoRefresh,
            refresh_interval_minutes: data.refreshIntervalMinutes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create segment');
      }

      return response.json() as Promise<Segment>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'leads', 'segments'],
      });
    },
  });
}

/**
 * Update a segment
 */
export function useUpdateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSegmentRequest) => {
      const response = await fetch(
        `/api/v1/crm/segments/${data.segmentId}?workspaceId=${data.workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            color: data.color,
            criteria: data.criteria,
            auto_refresh: data.autoRefresh,
            refresh_interval_minutes: data.refreshIntervalMinutes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update segment');
      }

      return response.json() as Promise<Segment>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'leads', 'segments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'leads', 'segments', variables.segmentId],
      });
    },
  });
}

/**
 * Delete a segment (soft delete)
 */
export function useDeleteSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      segmentId,
      workspaceId,
    }: {
      segmentId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/segments/${segmentId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete segment');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'leads', 'segments'],
      });
    },
  });
}

/**
 * Manually refresh a segment
 */
export function useRefreshSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      segmentId,
      workspaceId,
    }: {
      segmentId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/segments/${segmentId}/refresh?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to refresh segment');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'leads', 'segments', variables.segmentId],
      });
    },
  });
}
