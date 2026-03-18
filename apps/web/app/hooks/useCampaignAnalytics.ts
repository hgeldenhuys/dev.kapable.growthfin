/**
 * useCampaignAnalytics Hook
 * Campaign performance analytics data (updated for new backend structure)
 */

import { useQuery } from '@tanstack/react-query';
import type { DateRange } from '~/types/crm';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface CampaignAnalytics {
  serverTimestamp: string;
  metrics: {
    total: number;
    active: number;
    completed: number;
    draft: number;
    paused: number;
    cancelled: number;
    totalRecipients: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    clickThroughRate: number;
  };
  channelBreakdown: Array<{ channel: string; count: number }>;
  objectiveBreakdown: Array<{
    objective: string;
    count: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    avgOpenRate: number;
    avgClickRate: number;
  }>;
  timeSeries: Array<{
    date: string;
    campaignsCreated: number;
    recipientsAdded: number;
    messagesSent: number;
  }>;
  topPerformers: Array<{
    id: string;
    name: string;
    objective: string;
    status: string;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
  }>;
  execution: {
    avgExecutionTimeHours: number;
    completedCount: number;
  };
}

/**
 * Get campaign analytics
 */
export function useCampaignAnalytics(workspaceId: string, dateRange?: DateRange, days?: number) {
  return useQuery({
    // Use only stable values in queryKey - NOT the dateRange object which changes on every render
    queryKey: ['crm', 'analytics', 'campaigns', workspaceId, days],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });

      // Let the backend calculate dates from 'days' parameter for stability
      // The dateRange is only used as a fallback if days is not provided
      if (days) {
        params.append('days', days.toString());
      } else if (dateRange?.from) {
        params.append('startDate', dateRange.from);
        if (dateRange?.to) {
          params.append('endDate', dateRange.to);
        }
      }

      const response = await fetch(
        `/api/v1/crm/analytics/campaigns?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch campaign analytics' });
        throw new Error(errorText || 'Failed to fetch campaign analytics');
      }

      return response.json() as Promise<CampaignAnalytics>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
    // Real-time updates via SSE stream (useAnalyticsMetricsStream), no polling needed
    retry: 2, // Limit retries to prevent infinite loops
  });
}
