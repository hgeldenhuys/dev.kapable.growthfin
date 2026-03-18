/**
 * useCampaignCostROI Hook
 * Fetch campaign cost and ROI metrics
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CostROIData } from '~/components/crm/analytics/CostROICard';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

/**
 * Fetch cost and ROI metrics for a campaign
 */
export function useCampaignCostROI(workspaceId: string, campaignId: string) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'cost-roi', workspaceId, campaignId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/analytics/campaigns/${campaignId}/cost-roi?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch cost & ROI data' });
        throw new Error(errorText || 'Failed to fetch cost & ROI data');
      }

      return response.json() as Promise<CostROIData>;
    },
    enabled: !!workspaceId && !!campaignId,
    staleTime: 60000, // Cache for 1 minute
    // Real-time updates via SSE stream (useAnalyticsMetricsStream), no polling needed
    retry: 2, // Limit retries to prevent infinite loops
  });
}
