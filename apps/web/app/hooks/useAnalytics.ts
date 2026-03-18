/**
 * useAnalytics Hook
 * CRM metrics and analytics data
 */

import { useQuery } from '@tanstack/react-query';
import type { CRMMetrics, ChartData, DateRange } from '~/types/crm';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

/**
 * Get CRM metrics for analytics dashboard
 */
export function useCRMMetrics(workspaceId: string, dateRange?: DateRange) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'metrics', workspaceId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });

      if (dateRange?.from) {
        params.append('from', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('to', dateRange.to);
      }

      const response = await fetch(
        `/api/v1/crm/analytics/metrics?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch analytics metrics' });
        throw new Error(errorText || 'Failed to fetch analytics metrics');
      }

      return response.json() as Promise<CRMMetrics>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get chart data for analytics dashboard
 */
export function useCRMChartData(workspaceId: string, dateRange?: DateRange) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'charts', workspaceId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });

      if (dateRange?.from) {
        params.append('from', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('to', dateRange.to);
      }

      const response = await fetch(
        `/api/v1/crm/analytics/charts?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch chart data' });
        throw new Error(errorText || 'Failed to fetch chart data');
      }

      return response.json() as Promise<ChartData>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
  });
}
