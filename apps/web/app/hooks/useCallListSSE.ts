/**
 * useCallListSSE Hook
 * Real-time SSE updates for agent call list
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseCallListSSEOptions {
  workspaceId: string;
  userId: string;
  enabled?: boolean;
}

/**
 * Connect to SSE stream for call list updates
 * Invalidates React Query cache when leads are assigned/reassigned
 */
export function useCallListSSE({
  workspaceId,
  userId,
  enabled = true
}: UseCallListSSEOptions) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !workspaceId || !userId) return;

    const streamUrl = `/api/v1/crm/agent/call-list/stream?workspaceId=${workspaceId}&userId=${userId}`;
    // Log connection in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log(`[useCallListSSE] Connecting to SSE: ${streamUrl}`);
    }

    try {
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.log('[useCallListSSE] SSE connected for agent call list');
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.log('[useCallListSSE] SSE update received:', data);
          }

          // Invalidate call list query to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ['crm', 'agent', 'call-list', workspaceId]
          });
        } catch (error) {
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.error('[useCallListSSE] Error parsing SSE message:', error, event.data);
          }
        }
      };

      eventSource.onerror = (error) => {
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.error('[useCallListSSE] SSE error:', error);
        }
        eventSource.close();
      };
    } catch (error) {
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.error('[useCallListSSE] Failed to create EventSource:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.log('[useCallListSSE] Closing SSE connection');
        }
        eventSourceRef.current.close();
      }
    };
  }, [workspaceId, userId, queryClient, enabled]);
}
