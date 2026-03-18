/**
 * useCampaignFunnel Hook
 * Fetches campaign funnel data showing conversion at each stage
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
}

export interface FunnelConversionRates {
  recipientToLead: number;
  leadToQualified: number;
  qualifiedToOpportunity: number;
  overallConversion: number;
}

export interface CampaignFunnelData {
  stages: FunnelStage[];
  conversionRates: FunnelConversionRates;
}

/**
 * Fetch campaign funnel data
 */
export function useCampaignFunnel(workspaceId: string, campaignId: string) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'campaigns', workspaceId, campaignId, 'funnel'],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/analytics/campaigns/${campaignId}/funnel?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch campaign funnel' });
        throw new Error(errorText || 'Failed to fetch campaign funnel');
      }

      return response.json() as Promise<CampaignFunnelData>;
    },
    enabled: !!workspaceId && !!campaignId,
    staleTime: 60000, // Cache for 1 minute
  });
}
