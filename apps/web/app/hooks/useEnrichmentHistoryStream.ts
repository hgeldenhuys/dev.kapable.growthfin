/**
 * useEnrichmentHistoryStream Hook
 * SSE connection for real-time enrichment history updates
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useEnrichmentHistoryStream(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    // Create SSE connection
    const eventSource = new EventSource(
      `/api/v1/crm/enrichment-history/stream?workspaceId=${workspaceId}`
    );

    eventSourceRef.current = eventSource;

    // Handle connection open
    eventSource.addEventListener('open', () => {
      console.log('[SSE] Connected to enrichment history stream');
    });

    // Handle enrichment events
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different event types
        if (data.type === 'enrichment.completed') {
          console.log('[SSE] Enrichment completed:', data);

          // Invalidate queries for this entity
          queryClient.invalidateQueries({
            queryKey: ['enrichment-history', data.entityId, data.entityType],
          });

          // Show toast notification
          toast.success('Enrichment completed', {
            description: `New enrichment for ${data.entityType} ${data.entityId}`,
          });
        } else if (data.type === 'enrichment.started') {
          console.log('[SSE] Enrichment started:', data);

          // Invalidate queries to show pending state
          queryClient.invalidateQueries({
            queryKey: ['enrichment-history', data.entityId, data.entityType],
          });

          // Show toast notification
          toast.info('Enrichment started', {
            description: `Processing enrichment for ${data.entityType} ${data.entityId}`,
          });
        } else if (data.type === 'connection.ack') {
          console.log('[SSE] Connection acknowledged:', data);
        }
      } catch (error) {
        console.error('[SSE] Failed to parse event:', error);
        toast.error('Stream error', {
          description: 'Failed to process enrichment update',
        });
      }
    });

    // Handle errors
    eventSource.addEventListener('error', (error) => {
      console.error('[SSE] Connection error:', error);

      // Only show error if connection was established (not initial connection)
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('[SSE] Connection closed, will retry...');
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('[SSE] Closing connection');
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [workspaceId, queryClient]);

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}
