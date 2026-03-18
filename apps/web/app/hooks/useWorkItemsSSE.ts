/**
 * useWorkItemsSSE Hook
 *
 * Subscribes to real-time work item updates via BFF SSE endpoint.
 * When a work item change is received, triggers React Router revalidation.
 *
 * Part of US-014: Batch/WorkItem Semantic Separation
 *
 * Usage:
 * ```tsx
 * function WorkItemsPage() {
 *   const { workItems } = useLoaderData<typeof loader>();
 *   const { workspaceId, batchId } = useParams();
 *
 *   // Enable real-time updates
 *   useWorkItemsSSE(workspaceId, { batchId });
 *
 *   return <WorkItemList items={workItems} />;
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { useRevalidator } from 'react-router';

interface UseWorkItemsSSEOptions {
  /** Optional batch ID to filter work items */
  batchId?: string;
  /** Enable/disable SSE subscription (default: true) */
  enabled?: boolean;
  /** Callback when SSE message is received */
  onMessage?: (data: any) => void;
  /** Callback when SSE connection is established */
  onConnect?: () => void;
  /** Callback when SSE connection errors */
  onError?: (error: Event) => void;
}

// Max reconnect attempts before giving up
const MAX_RECONNECT_ATTEMPTS = 5;
// Initial reconnect delay in ms (doubles each attempt)
const INITIAL_RECONNECT_DELAY = 1000;

/**
 * Subscribe to real-time work item updates via SSE
 *
 * @param workspaceId - Workspace ID to filter work items
 * @param options - Configuration options
 */
export function useWorkItemsSSE(
  workspaceId: string | undefined,
  options: UseWorkItemsSSEOptions = {}
) {
  const { batchId, enabled = true, onMessage, onConnect, onError } = options;
  const revalidator = useRevalidator();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleaningUpRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect function with reconnect support
  const connect = useCallback(() => {
    if (!workspaceId || !enabled || isCleaningUpRef.current) return;

    // BFF SSE endpoint - same origin, no CORS issues
    const params = new URLSearchParams({
      workspaceId: workspaceId,
    });

    if (batchId) {
      params.set('batchId', batchId);
    }

    const streamUrl = `/api/v1/work-items/stream?${params.toString()}`;
    console.log(`[Work Items SSE] Connecting to: ${streamUrl} (attempt ${reconnectAttemptsRef.current + 1})`);

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[Work Items SSE] Connected - real-time updates enabled');
      reconnectAttemptsRef.current = 0; // Reset on successful connection
      onConnect?.();
    };

    eventSource.onmessage = (event) => {
      // Skip heartbeat messages (comments starting with :)
      if (event.data.startsWith(':')) return;

      console.log('[Work Items SSE] Update received:', event.data.substring(0, 100));

      // Parse data if it's JSON
      let data: any = event.data;
      try {
        data = JSON.parse(event.data);
      } catch {
        // Keep as string if not JSON
      }

      // Call custom handler if provided
      onMessage?.(data);

      // Revalidate loader data when SSE event arrives
      if (revalidator.state === 'idle') {
        console.log('[Work Items SSE] Revalidating loader data...');
        revalidator.revalidate();
      }
    };

    eventSource.onerror = (error) => {
      // Don't log or reconnect if we're cleaning up
      if (isCleaningUpRef.current) return;

      console.warn('[Work Items SSE] Connection error, will attempt reconnect');
      onError?.(error);

      // Close the current connection
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnect with exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(`[Work Items SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isCleaningUpRef.current) {
            connect();
          }
        }, delay);
      } else {
        console.error('[Work Items SSE] Max reconnect attempts reached. Please refresh the page.');
      }
    };
  }, [workspaceId, batchId, enabled, revalidator, onMessage, onConnect, onError]);

  useEffect(() => {
    if (!workspaceId || !enabled) return;

    // Reset state for new connection
    isCleaningUpRef.current = false;
    reconnectAttemptsRef.current = 0;

    // Start connection
    connect();

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log('[Work Items SSE] Cleaning up connection');
      cleanup();
    };
  }, [workspaceId, batchId, enabled, connect, cleanup]);

  return {
    /** Close the SSE connection manually */
    close: cleanup,
    /** Check if SSE is connected (client-side only) */
    isConnected: typeof EventSource !== 'undefined' && eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}
