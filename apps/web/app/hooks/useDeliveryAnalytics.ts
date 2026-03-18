/**
 * useDeliveryAnalytics Hook
 * Fetches delivery summary dashboard data (Phase H.2)
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export type DeliveryDateRange = '7d' | '30d' | '90d' | 'all';

export interface ChannelDeliveryStats {
  sent: number;
  delivered: number;
  rate: number;
}

export interface CampaignDeliveryStats {
  id: string;
  name: string;
  channel: string;
  sent: number;
  delivered: number;
  bounced: number;
  deliveryRate: number;
  lastUpdated: string | null;
}

export interface DeliveryFailure {
  id: string;
  campaignId: string;
  campaignName: string;
  recipientId: string;
  channel: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
}

export interface DeliverySummaryData {
  serverTimestamp: string;
  dateRange: DeliveryDateRange;
  overallDeliveryRate: number;
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  byChannel: Record<string, ChannelDeliveryStats>;
  topCampaigns: CampaignDeliveryStats[];
  bottomCampaigns: CampaignDeliveryStats[];
  recentFailures: DeliveryFailure[];
  _meta: {
    queryTime: number;
    lastUpdated: string;
  };
}

/**
 * Fetch delivery summary analytics
 */
export function useDeliveryAnalytics(
  workspaceId: string,
  dateRange: DeliveryDateRange = '30d'
) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'delivery-summary', workspaceId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        dateRange,
      });

      const response = await fetch(
        `/api/v1/crm/analytics/delivery-summary?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch delivery analytics' });
        throw new Error(errorText || 'Failed to fetch delivery analytics');
      }

      return response.json() as Promise<DeliverySummaryData>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
    retry: 2,
  });
}
