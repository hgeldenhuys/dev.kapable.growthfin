/**
 * useLeadScoresStream Hook
 * Real-time lead propensity score updates via SSE
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - React Query cache invalidation on updates
 * - Workspace and lead filtering
 * - <500ms latency from DB to UI
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface ScoreChangedEvent {
  type: 'score_changed';
  leadId: string;
  workspaceId: string;
  scoreBefore: number;
  scoreAfter: number;
  updatedAt: string;
}

interface UseLeadScoresStreamOptions {
  workspaceId: string;
  userId?: string;
  leadIds?: string[]; // Filter to specific leads
  enabled?: boolean; // Enable/disable the stream
  onScoreChanged?: (event: ScoreChangedEvent) => void; // Callback for score changes
}

/**
 * Subscribe to real-time lead score updates
 * Automatically invalidates relevant React Query queries when scores change
 */
export function useLeadScoresStream(options: UseLeadScoresStreamOptions) {
  const {
    workspaceId,
    userId,
    leadIds,
    enabled = true,
    onScoreChanged,
  } = options;

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  // Store callback in ref to avoid recreating connection on callback changes
  const onScoreChangedRef = useRef(onScoreChanged);
  onScoreChangedRef.current = onScoreChanged;

  useEffect(() => {
    if (!enabled || !workspaceId) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      // Build query parameters
      const params = new URLSearchParams({
        workspaceId,
      });

      if (userId) {
        params.append('userId', userId);
      }

      if (leadIds && leadIds.length > 0) {
        params.append('leadIds', leadIds.join(','));
      }

      const url = `/api/v1/stream/crm/leads/scores?${params.toString()}`;

      console.log('[useLeadScoresStream] Connecting to SSE stream:', url);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useLeadScoresStream] SSE connection established');
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ScoreChangedEvent = JSON.parse(event.data);

          if (data.type === 'score_changed') {
            console.log('[useLeadScoresStream] Score changed:', {
              leadId: data.leadId,
              scoreBefore: data.scoreBefore,
              scoreAfter: data.scoreAfter,
            });

            // Invalidate queries
            // 1. Invalidate lead list queries
            queryClient.invalidateQueries({
              queryKey: ['crm', 'leads', workspaceId],
            });

            // 2. Invalidate specific lead query
            queryClient.invalidateQueries({
              queryKey: ['crm', 'lead', data.leadId],
            });

            // 3. Invalidate agent dashboard queries (if they depend on scores)
            queryClient.invalidateQueries({
              queryKey: ['crm', 'agent', 'call-list', workspaceId],
            });

            // 4. Call custom callback if provided
            if (onScoreChangedRef.current) {
              onScoreChangedRef.current(data);
            }
          }
        } catch (error) {
          console.error('[useLeadScoresStream] Error parsing event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[useLeadScoresStream] SSE error:', error);
        eventSource.close();

        // Exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Max 30 seconds
          reconnectAttempts.current++;

          console.log(
            `[useLeadScoresStream] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connect();
            }
          }, delay);
        } else {
          console.error('[useLeadScoresStream] Max reconnection attempts reached');
        }
      };
    };

    connect();

    // Cleanup
    return () => {
      isMounted = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (eventSourceRef.current) {
        console.log('[useLeadScoresStream] Closing SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // Note: queryClient is stable from TanStack Query, doesn't cause rerenders
    // onScoreChanged stored in ref to avoid recreating connection
  }, [workspaceId, userId, leadIds?.join(','), enabled, queryClient]);

  return {
    // Could expose connection state here if needed
    isConnected:
      typeof EventSource !== 'undefined' &&
      eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}
