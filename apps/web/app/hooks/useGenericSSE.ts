/**
 * Generic SSE Hook
 *
 * Reusable hook for streaming any table via SSE + React Query.
 * Uses the multiplexed /api/stream endpoint.
 *
 * Example usage:
 * ```typescript
 * // Stream workspaces
 * const { data, isLoading } = useGenericSSE({
 *   table: 'workspaces',
 *   queryKey: ['workspaces']
 * });
 *
 * // Stream personas for a project
 * const { data, isLoading } = useGenericSSE({
 *   table: 'personas',
 *   where: `project_id='${projectId}'`,
 *   queryKey: ['personas', projectId]
 * });
 *
 * // Stream with specific columns
 * const { data, isLoading } = useGenericSSE({
 *   table: 'sessions',
 *   where: `project_id='${projectId}'`,
 *   columns: ['id', 'title', 'status'],
 *   queryKey: ['sessions', projectId]
 * });
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

interface UseGenericSSEOptions<T> {
  /** Table name to stream */
  table: string;

  /** SQL WHERE clause (optional) */
  where?: string;

  /** Specific IDs to subscribe to (optional) */
  ids?: string[];

  /** Column list (optional) */
  columns?: string[];

  /** React Query key */
  queryKey: unknown[];

  /** Initial data fetcher */
  fetchFn: () => Promise<T[]>;

  /** Enable/disable the hook */
  enabled?: boolean;
}

/**
 * Generic SSE + React Query hook
 */
export function useGenericSSE<T>({
  table,
  where,
  ids,
  columns,
  queryKey,
  fetchFn,
  enabled = true,
}: UseGenericSSEOptions<T>) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial data using React Query
  const query = useQuery({
    queryKey,
    queryFn: fetchFn,
    enabled,
  });

  // Set up SSE for real-time updates
  useEffect(() => {
    if (!enabled) return;

    // Build stream URL with query parameters
    const params = new URLSearchParams({ table });
    if (where) params.set('where', where);
    if (ids && ids.length > 0) params.set('ids', ids.join(','));
    if (columns) params.set('columns', columns.join(','));

    const streamUrl = `/api/stream?${params.toString()}`;
    console.log(`[useGenericSSE] Connecting to SSE: ${streamUrl}`);

    try {
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[useGenericSSE] SSE connected for table: ${table}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log(`[useGenericSSE] SSE update received for ${table}:`, data);

          // Invalidate the query to trigger a refetch
          queryClient.invalidateQueries({ queryKey });
        } catch (error) {
          console.error(`[useGenericSSE] Error parsing SSE message for ${table}:`, error, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`[useGenericSSE] SSE error for ${table}:`, error);
        eventSource.close();
      };
    } catch (error) {
      console.error(`[useGenericSSE] Failed to create EventSource for ${table}:`, error);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (eventSourceRef.current) {
        console.log(`[useGenericSSE] Closing SSE connection for table: ${table}`);
        eventSourceRef.current.close();
      }
    };
  }, [table, where, ids?.join(','), columns?.join(','), queryClient, enabled]);

  return query;
}
