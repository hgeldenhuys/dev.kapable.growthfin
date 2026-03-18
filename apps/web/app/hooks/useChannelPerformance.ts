/**
 * useChannelPerformance Hook
 * Fetches channel performance comparison data
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export type DateRangeFilter = '7d' | '30d' | '90d' | 'all';

export interface ChannelPerformance {
  channel: string;
  totalCampaigns: number;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  costPerSend: number;
}

export interface ChannelPerformanceData {
  channels: ChannelPerformance[];
}

/**
 * Fetch channel performance data
 */
export function useChannelPerformance(
  workspaceId: string,
  dateRange: DateRangeFilter = '30d'
) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'channel-performance', workspaceId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        dateRange,
      });

      // Use consistent URL pattern with other analytics routes
      const response = await fetch(
        `/api/v1/crm/analytics/channel-performance?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch channel performance' });
        throw new Error(errorText || 'Failed to fetch channel performance');
      }

      return response.json() as Promise<ChannelPerformanceData>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
  });
}
