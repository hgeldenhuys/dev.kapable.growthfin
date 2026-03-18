/**
 * useAudioSSE Hook
 * Real-time audio generation updates via SSE
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Filters updates by message IDs
 * - Auto-updates button state when generation completes
 * - <1s latency from generation completion to UI update
 */

import { useEffect, useRef, useState } from 'react';

interface AudioGenerationEvent {
  messageId: string;
  audioUrl: string;
  voiceId: string;
  role: 'user' | 'assistant';
  generatedAt: string;
}

interface UseAudioSSEOptions {
  messageIds: string[]; // Array of message IDs to monitor
  enabled?: boolean; // Enable/disable the stream
  onAudioGenerated?: (event: AudioGenerationEvent) => void; // Callback for updates
}

/**
 * Subscribe to real-time audio generation updates
 * Only connects when there are message IDs to monitor
 */
export function useAudioSSE(options: UseAudioSSEOptions) {
  const {
    messageIds,
    enabled = true,
    onAudioGenerated,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [events, setEvents] = useState<AudioGenerationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Don't connect if disabled or no message IDs to monitor
    if (!enabled || messageIds.length === 0) {
      setIsConnected(false);
      return;
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      // Build URL with comma-separated message IDs
      const messageIdParam = messageIds.join(',');
      const url = `/api/v1/stream/audio?messageIds=${encodeURIComponent(messageIdParam)}`;

      console.log('[useAudioSSE] Connecting to SSE stream:', url);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useAudioSSE] SSE connection established');
        setIsConnected(true);
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data: AudioGenerationEvent = JSON.parse(event.data);

          if (data.type === 'generation_complete') {
            console.log('[useAudioSSE] Audio generated:', {
              messageId: data.messageId,
              audioUrl: data.audioUrl,
              generatedAt: data.generatedAt,
            });

            // Update events list
            setEvents(prev => [...prev, data]);

            // Call custom callback if provided
            if (onAudioGenerated) {
              onAudioGenerated(data);
            }
          }
        } catch (error) {
          console.error('[useAudioSSE] Error parsing event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[useAudioSSE] SSE error:', error);
        setIsConnected(false);
        eventSource.close();

        // Exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = 1000 * Math.pow(2, reconnectAttempts.current); // 1s, 2s, 4s, 8s, 16s
          reconnectAttempts.current++;

          console.log(
            `[useAudioSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connect();
            }
          }, delay);
        } else {
          console.error('[useAudioSSE] Max reconnection attempts reached');
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
        console.log('[useAudioSSE] Closing SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setIsConnected(false);
    };
  }, [messageIds.join(','), enabled, onAudioGenerated]); // Stable dependency on messageIds array

  return {
    events,
    isConnected,
  };
}
