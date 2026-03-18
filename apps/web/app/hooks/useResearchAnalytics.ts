/**
 * useResearchAnalytics Hook
 * Research performance analytics data (updated for new backend structure)
 */

import { useQuery } from '@tanstack/react-query';
import type { DateRange } from '~/types/crm';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface ResearchAnalytics {
  serverTimestamp: string;
  sessions: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    stopped: number;
    completionRate: number;
    totalQueries: number;
    totalFindings: number;
    totalCostCents: number;
    totalCostDollars: number;
  };
  findings: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    applied: number;
    avgConfidence: number;
    approvalRate: number;
    rejectionRate: number;
    applicationRate: number;
  };
  fieldTypeBreakdown: Array<{
    field: string;
    count: number;
    avgConfidence: number;
    approvedCount: number;
    appliedCount: number;
    approvalRate: number;
  }>;
  scopeBreakdown: Array<{
    scope: string;
    sessionCount: number;
    avgQueries: number;
    avgFindings: number;
    avgCostCents: number;
  }>;
  timeSeries: Array<{
    date: string;
    sessionsCreated: number;
    queriesExecuted: number;
    findingsGenerated: number;
  }>;
}

/**
 * Get research analytics
 */
export function useResearchAnalytics(workspaceId: string, dateRange?: DateRange, days?: number) {
  return useQuery({
    // Use only stable values in queryKey - NOT the dateRange object which changes on every render
    queryKey: ['crm', 'analytics', 'research', workspaceId, days],
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
        `/api/v1/crm/analytics/research?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch research analytics' });
        throw new Error(errorText || 'Failed to fetch research analytics');
      }

      return response.json() as Promise<ResearchAnalytics>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
    // Real-time updates via SSE stream (useAnalyticsMetricsStream), no polling needed
    retry: 2, // Limit retries to prevent infinite loops
  });
}
