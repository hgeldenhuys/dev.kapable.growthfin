/**
 * Shared SSE Hook with Cross-Tab Connection Pooling
 *
 * Reduces SSE connections by sharing them across browser tabs using BroadcastChannel.
 * Implements leader election: one tab maintains the SSE connection and broadcasts
 * events to all other tabs.
 *
 * Features:
 * - Leader election (first tab to connect becomes leader)
 * - Automatic leader re-election when leader tab closes
 * - Connection pooling by subscription signature
 * - Graceful fallback to individual connections (for old browsers)
 * - Heartbeat monitoring for leader health
 *
 * Example usage:
 * ```typescript
 * const { data, isLoading } = useSharedSSE({
 *   table: 'workspaces',
 *   queryKey: ['workspaces'],
 *   fetchFn: getWorkspacesFn,
 * });
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

interface UseSharedSSEOptions<T> {
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

  /** Enable shared connections (default: true) */
  sharedConnection?: boolean;
}

interface BroadcastMessage {
  type: 'leader-announce' | 'sse-event' | 'leader-closing' | 'heartbeat' | 'election-request';
  signature?: string;
  data?: any;
  timestamp?: number;
}

/**
 * Generate unique subscription signature for connection pooling
 */
function getSubscriptionSignature(
  table: string,
  where?: string,
  ids?: string[],
  columns?: string[]
): string {
  const parts = [
    table,
    where || 'none',
    ids?.sort().join(',') || 'none',
    columns?.sort().join(',') || 'all',
  ];
  return parts.join(':');
}

/**
 * Check if BroadcastChannel is supported
 */
function isBroadcastChannelSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

/**
 * Shared SSE Hook with cross-tab connection pooling
 */
export function useSharedSSE<T>({
  table,
  where,
  ids,
  columns,
  queryKey,
  fetchFn,
  enabled = true,
  sharedConnection = true,
}: UseSharedSSEOptions<T>) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isLeaderRef = useRef(false); // Use ref for synchronous access
  const isSettingUpRef = useRef(false); // Prevent double setup in strict mode
  const electricUnavailableRef = useRef(false); // Track if ElectricSQL is unavailable
  const [isLeader, setIsLeader] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const leaderHeartbeatRef = useRef<number>(0); // Initialize to 0, not Date.now()

  // Generate subscription signature
  const signature = getSubscriptionSignature(table, where, ids, columns);

  // Fetch initial data using React Query
  const query = useQuery({
    queryKey,
    queryFn: fetchFn,
    enabled,
  });

  // Clean up on unmount or when dependencies change
  useEffect(() => {
    if (!enabled) return;

    // Check if we should use shared connections
    const useSharedConnection = sharedConnection && isBroadcastChannelSupported();

    if (!useSharedConnection) {
      // Fallback to individual connection (old browser or disabled)
      console.log(`[useSharedSSE] Fallback to individual connection for: ${signature}`);
      setupIndividualConnection();
      return;
    }

    // Use shared connection with leader election
    const channelName = `agios-sse:${signature}`;
    console.log(`[useSharedSSE] Setting up shared connection`);
    console.log(`[useSharedSSE] Signature: ${signature}`);
    console.log(`[useSharedSSE] Channel: ${channelName}`);
    setupSharedConnection();

    return () => {
      cleanup();
    };
  }, [table, where, ids?.join(','), columns?.join(','), enabled, sharedConnection]);

  /**
   * Setup individual SSE connection (fallback mode)
   */
  async function setupIndividualConnection() {
    const params = new URLSearchParams({ table });
    if (where) params.set('where', where);
    if (ids && ids.length > 0) params.set('ids', ids.join(','));
    if (columns) params.set('columns', columns.join(','));

    const streamUrl = `/api/v1/stream?${params.toString()}`;

    // Check if ElectricSQL is available before creating EventSource
    try {
      const checkResponse = await fetch(streamUrl, { method: 'HEAD' }).catch(() => null);
      if (checkResponse?.status === 503) {
        console.log(`[useSharedSSE] ElectricSQL unavailable for: ${signature} - real-time updates disabled`);
        electricUnavailableRef.current = true;
        return;
      }
    } catch {
      // Ignore errors, try to connect anyway
    }

    if (electricUnavailableRef.current) return;

    console.log(`[useSharedSSE] Creating individual SSE connection: ${streamUrl}`);

    try {
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[useSharedSSE] Individual SSE connected for: ${signature}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[useSharedSSE] SSE update received:`, data);
          queryClient.invalidateQueries({ queryKey });
        } catch (error) {
          console.error(`[useSharedSSE] Error parsing SSE message:`, error);
        }
      };

      eventSource.onerror = (error) => {
        // Only log if actually closed
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error(`[useSharedSSE] Individual SSE connection closed`);
        }
        eventSource.close();
      };
    } catch (error) {
      console.error(`[useSharedSSE] Failed to create EventSource:`, error);
    }
  }

  /**
   * Setup shared SSE connection with leader election
   */
  function setupSharedConnection() {
    // Prevent double setup in React strict mode
    if (isSettingUpRef.current) {
      console.log(`[useSharedSSE] Already setting up, skipping duplicate`);
      return;
    }
    isSettingUpRef.current = true;

    // Create BroadcastChannel for this subscription signature
    const channelName = `agios-sse:${signature}`;
    const channel = new BroadcastChannel(channelName);
    broadcastChannelRef.current = channel;

    console.log(`[useSharedSSE] Joined BroadcastChannel: ${channelName}`);

    // Listen for messages from other tabs
    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data;
      console.log(`[useSharedSSE] Received message:`, message.type, message.signature);

      switch (message.type) {
        case 'leader-announce':
          // Another tab is leader, we are follower
          if (!isLeaderRef.current) {
            console.log(`[useSharedSSE] Leader detected for: ${signature}`);
            leaderHeartbeatRef.current = Date.now();
          }
          break;

        case 'sse-event':
          // Received SSE event from leader tab
          if (!isLeaderRef.current && message.signature === signature) {
            console.log(`[useSharedSSE] Received SSE event from leader:`, message.data);
            queryClient.invalidateQueries({ queryKey });
          }
          break;

        case 'leader-closing':
          // Leader is closing, trigger election
          if (!isLeaderRef.current && message.signature === signature) {
            console.log(`[useSharedSSE] Leader closing, starting election`);
            // Wait a bit for race condition, then become leader if no one else does
            setTimeout(() => {
              if (!isLeaderRef.current && Date.now() - leaderHeartbeatRef.current > 1000) {
                becomeLeader();
              }
            }, 200);
          }
          break;

        case 'heartbeat':
          // Leader heartbeat
          if (!isLeaderRef.current && message.signature === signature) {
            leaderHeartbeatRef.current = Date.now();
          }
          break;

        case 'election-request':
          // Another tab wants to know if there's a leader
          if (isLeaderRef.current) {
            channel.postMessage({
              type: 'leader-announce',
              signature,
              timestamp: Date.now(),
            } as BroadcastMessage);
          }
          break;
      }
    };

    // Request leader status
    channel.postMessage({
      type: 'election-request',
      signature,
      timestamp: Date.now(),
    } as BroadcastMessage);

    // If no leader responds in 300ms, become leader
    const electionTimeout = setTimeout(() => {
      // Check if any leader has ever announced (heartbeat would be > 0)
      if (!isLeaderRef.current && leaderHeartbeatRef.current === 0) {
        console.log(`[useSharedSSE] No leader detected after 300ms, becoming leader`);
        becomeLeader();
      } else {
        console.log(`[useSharedSSE] Leader already exists, staying as follower`);
      }
    }, 300);

    // Monitor leader heartbeat (followers only)
    const heartbeatMonitor = setInterval(() => {
      // Only check timeout if we've detected a leader before (heartbeat > 0)
      if (!isLeaderRef.current && leaderHeartbeatRef.current > 0 && Date.now() - leaderHeartbeatRef.current > 3000) {
        console.warn(`[useSharedSSE] Leader heartbeat timeout, becoming leader`);
        becomeLeader();
      }
    }, 1000);

    return () => {
      clearTimeout(electionTimeout);
      clearInterval(heartbeatMonitor);
    };
  }

  /**
   * Become the leader and create SSE connection
   */
  async function becomeLeader() {
    if (isLeaderRef.current) return;
    if (electricUnavailableRef.current) return;

    console.log(`[useSharedSSE] Becoming leader for: ${signature}`);
    isLeaderRef.current = true;
    setIsLeader(true);

    // Announce leadership
    const channel = broadcastChannelRef.current;
    if (channel) {
      console.log(`[useSharedSSE] Announcing leadership for: ${signature}`);
      channel.postMessage({
        type: 'leader-announce',
        signature,
        timestamp: Date.now(),
      } as BroadcastMessage);
    }

    // Create SSE connection
    const params = new URLSearchParams({ table });
    if (where) params.set('where', where);
    if (ids && ids.length > 0) params.set('ids', ids.join(','));
    if (columns) params.set('columns', columns.join(','));

    const streamUrl = `/api/v1/stream?${params.toString()}`;

    // Check if ElectricSQL is available before creating EventSource
    try {
      const checkResponse = await fetch(streamUrl, { method: 'HEAD' }).catch(() => null);
      if (checkResponse?.status === 503) {
        console.log(`[useSharedSSE] ElectricSQL unavailable for leader: ${signature} - real-time updates disabled`);
        electricUnavailableRef.current = true;
        return;
      }
    } catch {
      // Ignore errors, try to connect anyway
    }

    if (electricUnavailableRef.current) return;

    try {
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        // Suppress connection success logs
        // console.log(`[useSharedSSE] Leader SSE connected for: ${signature}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Suppress event logs - too noisy
          // console.log(`[useSharedSSE] Leader received SSE event:`, data);

          // Invalidate our own query
          queryClient.invalidateQueries({ queryKey });

          // Broadcast to follower tabs
          if (channel) {
            // Suppress broadcast logs
            // console.log(`[useSharedSSE] Broadcasting SSE event to followers:`, data);
            channel.postMessage({
              type: 'sse-event',
              signature,
              data,
              timestamp: Date.now(),
            } as BroadcastMessage);
          }
        } catch (error) {
          console.error(`[useSharedSSE] Error parsing SSE message:`, error);
        }
      };

      eventSource.onerror = (error) => {
        // SSE connections often throw errors during reconnection cycles
        // Only log actual closure as an error
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error(`[useSharedSSE] SSE connection closed for: ${signature}`);
          eventSource.close();
          eventSourceRef.current = null;
        } else {
          // This is normal during reconnection - don't log as error
          // The connection will automatically reconnect
        }
      };
    } catch (error) {
      console.error(`[useSharedSSE] Failed to create EventSource:`, error);
    }

    // Send heartbeat every 2 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (channel && isLeaderRef.current) {
        channel.postMessage({
          type: 'heartbeat',
          signature,
          timestamp: Date.now(),
        } as BroadcastMessage);
      }
    }, 2000);
  }

  /**
   * Cleanup connections and channels
   */
  function cleanup() {
    console.log(`[useSharedSSE] Cleaning up for: ${signature}`);

    // Close SSE connection if leader
    if (eventSourceRef.current) {
      console.log(`[useSharedSSE] Closing SSE connection`);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Announce leader closing
    if (isLeaderRef.current && broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'leader-closing',
        signature,
        timestamp: Date.now(),
      } as BroadcastMessage);
    }

    // Close BroadcastChannel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }

    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Reset state for React Strict Mode
    isLeaderRef.current = false;
    setIsLeader(false);
    isSettingUpRef.current = false;
  }

  return {
    ...query,
    isLeader, // Expose leader status for UI indicators
  };
}
