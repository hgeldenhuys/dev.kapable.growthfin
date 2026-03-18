/**
 * useRealtimeStream Hook
 *
 * Manages SSE connection for real-time updates and integrates with the Zustand store
 */

import { useEffect, useRef } from 'react';
import { useRealtimeStore } from '~/stores';
import type { SSEUpdate } from '~/stores/types';

export interface RealtimeStreamOptions {
  /**
   * API base URL (defaults to empty string for proxy routes)
   */
  apiUrl?: string;

  /**
   * Entity types to stream (e.g., ['workspaces', 'projects', 'personas'])
   */
  entities?: ('workspaces' | 'projects' | 'personas')[];

  /**
   * Optional filters
   */
  filters?: {
    workspaceId?: string;
    projectId?: string;
  };

  /**
   * Whether to enable the stream
   */
  enabled?: boolean;

  /**
   * Reconnection settings
   */
  reconnect?: {
    delay?: number;
    maxAttempts?: number;
  };

  /**
   * Callbacks
   */
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * Connect to real-time SSE streams for workspace, project, and persona updates
 */
export function useRealtimeStream(options: RealtimeStreamOptions = {}) {
  const {
    apiUrl = '', // Client-side uses proxy routes, empty string for relative paths
    entities = ['workspaces', 'projects', 'personas'],
    filters,
    enabled = true,
    reconnect = { delay: 3000, maxAttempts: 10 },
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const mountedRef = useRef(true);

  // Get store instance without subscribing to avoid infinite loops
  const getStore = () => useRealtimeStore.getState();

  // Connect to all requested entity streams
  useEffect(() => {
    if (!enabled) {
      return;
    }

    mountedRef.current = true;

    // Connect to each entity type
    for (const entityType of entities) {
      // Skip if already connected
      if (eventSourcesRef.current.has(entityType)) {
        continue;
      }

      // Build stream URL
      let streamUrl = `${apiUrl}/api/v1/${entityType}/stream`;
      const params = new URLSearchParams();

      if (entityType === 'projects' && filters?.workspaceId) {
        params.append('workspaceId', filters.workspaceId);
      }
      if (entityType === 'personas' && filters?.projectId) {
        params.append('projectId', filters.projectId);
      }

      const queryString = params.toString();
      if (queryString) {
        streamUrl += `?${queryString}`;
      }

      console.log(`[useRealtimeStream] Connecting to ${streamUrl}`);
      getStore().setSSEStatus('connecting');

      try {
        const eventSource = new EventSource(streamUrl);
        eventSourcesRef.current.set(entityType, eventSource);

        eventSource.onopen = () => {
          if (!mountedRef.current) return;
          console.log(`[useRealtimeStream] Connected to ${entityType} stream`);
          reconnectAttemptsRef.current.set(entityType, 0);
          getStore().setSSEStatus('connected');
          getStore().connectSSE(eventSource);
          onConnect?.();
        };

        eventSource.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(event.data);

            if (data.action && data.value) {
              const update: SSEUpdate = {
                type: `${entityType}:${data.action}` as any,
                data: data.value,
                timestamp: new Date().toISOString(),
              };

              console.log(`[useRealtimeStream] Received ${update.type}:`, update.data);
              getStore().handleSSEUpdate(update);
            }
          } catch (error) {
            console.error(`[useRealtimeStream] Error parsing message:`, error);
          }
        };

        eventSource.onerror = (error) => {
          if (!mountedRef.current) return;
          console.error(`[useRealtimeStream] Error on ${entityType} stream:`, error);
          getStore().setSSEStatus('error', 'Connection error');
          onError?.(error);

          // Close and clean up
          eventSource.close();
          eventSourcesRef.current.delete(entityType);

          // Attempt reconnection
          const attempts = reconnectAttemptsRef.current.get(entityType) || 0;
          if (attempts < (reconnect.maxAttempts || 10)) {
            reconnectAttemptsRef.current.set(entityType, attempts + 1);
            console.log(
              `[useRealtimeStream] Reconnecting ${entityType} (attempt ${attempts + 1}/${reconnect.maxAttempts}) in ${reconnect.delay}ms...`
            );

            const timeout = setTimeout(() => {
              if (!mountedRef.current) return;
              // Trigger reconnection by clearing and letting effect re-run
              eventSourcesRef.current.delete(entityType);
            }, reconnect.delay || 3000);

            reconnectTimeoutsRef.current.set(entityType, timeout);
          } else {
            console.error(`[useRealtimeStream] Max reconnection attempts reached for ${entityType}`);
            getStore().setSSEStatus('disconnected', `Max reconnection attempts reached for ${entityType}`);
          }
        };
      } catch (error) {
        console.error(`[useRealtimeStream] Failed to create EventSource for ${entityType}:`, error);
        getStore().setSSEStatus('error', String(error));
      }
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      console.log('[useRealtimeStream] Cleaning up all streams...');

      // Clear all reconnect timeouts
      for (const timeout of reconnectTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      reconnectTimeoutsRef.current.clear();

      // Close all event sources
      for (const [entityType, eventSource] of eventSourcesRef.current.entries()) {
        console.log(`[useRealtimeStream] Closing ${entityType} stream`);
        eventSource.close();
      }
      eventSourcesRef.current.clear();
      reconnectAttemptsRef.current.clear();

      onDisconnect?.();
    };
    // Only depend on primitive values, not callbacks or objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, apiUrl, entities.join(','), filters?.workspaceId, filters?.projectId]);

  return {
    disconnect: () => {
      mountedRef.current = false;
      for (const eventSource of eventSourcesRef.current.values()) {
        eventSource.close();
      }
      eventSourcesRef.current.clear();
    },
  };
}
