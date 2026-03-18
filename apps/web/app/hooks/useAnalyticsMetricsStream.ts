/**
 * useAnalyticsMetricsStream Hook
 * Real-time campaign analytics updates via SSE
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - React Query cache invalidation on metrics updates
 * - Campaign and workspace filtering
 * - <500ms latency from DB to UI
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';

interface CampaignMetricsUpdateEvent {
  type: string;
  campaignId: string;
  workspaceId: string;
  updatedAt: string;
}

interface UseAnalyticsMetricsStreamOptions {
  workspaceId: string;
  campaignId?: string; // If provided, only listen to this campaign
  enabled?: boolean; // Enable/disable the stream
  onMetricsUpdated?: (event: CampaignMetricsUpdateEvent) => void; // Callback for updates
}

/**
 * Subscribe to real-time campaign analytics updates
 * Automatically invalidates relevant React Query queries when metrics change
 */
export function useAnalyticsMetricsStream(options: UseAnalyticsMetricsStreamOptions) {
  const {
    workspaceId,
    campaignId,
    enabled = true,
    onMetricsUpdated,
  } = options;

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Store callback in ref to avoid recreating connection on callback changes
  const onMetricsUpdatedRef = useRef(onMetricsUpdated);
  onMetricsUpdatedRef.current = onMetricsUpdated;

  useEffect(() => {
    if (!enabled || !workspaceId) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      // Build URL based on whether we're filtering by campaign
      let url: string;
      if (campaignId) {
        url = `/api/v1/stream/crm/analytics/campaigns/${campaignId}/metrics?workspaceId=${workspaceId}`;
      } else {
        url = `/api/v1/stream/crm/analytics/metrics?workspaceId=${workspaceId}`;
      }

      console.log('[useAnalyticsMetricsStream] Connecting to SSE stream:', url);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useAnalyticsMetricsStream] SSE connection established');
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data: CampaignMetricsUpdateEvent = JSON.parse(event.data);

          if (data.type === 'campaign_metrics_update') {
            console.log('[useAnalyticsMetricsStream] Metrics updated:', {
              campaignId: data.campaignId,
              workspaceId: data.workspaceId,
              updatedAt: data.updatedAt,
            });

            // Invalidate analytics queries
            // 1. Campaign funnel data (matches useCampaignFunnel.ts)
            queryClient.invalidateQueries({
              queryKey: ['crm', 'analytics', 'campaigns', workspaceId, data.campaignId, 'funnel'],
            });

            // 2. Campaign cost & ROI data (matches useCampaignCostROI.ts)
            queryClient.invalidateQueries({
              queryKey: ['crm', 'analytics', 'cost-roi', workspaceId, data.campaignId],
            });

            // 3. Channel performance (workspace-level) (matches useChannelPerformance.ts)
            queryClient.invalidateQueries({
              queryKey: ['crm', 'analytics', 'channel-performance', workspaceId],
            });

            // 4. Overall campaign analytics (workspace-level) (matches useCampaignAnalytics.ts)
            queryClient.invalidateQueries({
              queryKey: ['crm', 'analytics', 'campaigns', workspaceId],
            });

            // 5. Activity timeline (matches useActivityTimeline.ts)
            queryClient.invalidateQueries({
              queryKey: ['crm', 'analytics', 'dashboard', workspaceId],
            });

            // 7. Call custom callback if provided
            if (onMetricsUpdatedRef.current) {
              onMetricsUpdatedRef.current(data);
            }
          }
        } catch (error) {
          console.error('[useAnalyticsMetricsStream] Error parsing event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[useAnalyticsMetricsStream] SSE error:', error);
        eventSource.close();

        // Exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = 1000 * Math.pow(2, reconnectAttempts.current); // 1s, 2s, 4s, 8s, 16s
          reconnectAttempts.current++;

          console.log(
            `[useAnalyticsMetricsStream] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connect();
            }
          }, delay);
        } else {
          console.error('[useAnalyticsMetricsStream] Max reconnection attempts reached');
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
        console.log('[useAnalyticsMetricsStream] Closing SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // Note: queryClient is stable from TanStack Query, doesn't cause rerenders
    // onMetricsUpdated stored in ref to avoid recreating connection
  }, [workspaceId, campaignId, enabled, queryClient]);

  return {
    // Expose connection state for optional UI indicators
    isConnected:
      typeof EventSource !== 'undefined' &&
      eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}
