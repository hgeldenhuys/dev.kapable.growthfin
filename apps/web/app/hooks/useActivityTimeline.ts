/**
 * useActivityTimeline Hook
 * Recent activity timeline data for analytics (uses dashboard endpoint)
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface TimelineActivity {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  eventCategory: string;
  eventLabel: string;
  summary: string;
  occurredAt: string;
  actorType: string;
  actorName: string;
}

export interface DashboardAnalytics {
  serverTimestamp: string;
  summary: {
    campaigns: {
      total: number;
      active: number;
      completed: number;
      totalSent: number;
      totalOpened: number;
      openRate: number;
    };
    research: {
      total: number;
      completed: number;
      totalFindings: number;
    };
  };
  recentActivity: TimelineActivity[];
  growth: {
    campaigns: {
      weekOverWeek: number;
      monthOverMonth: number;
      thisWeek: number;
      thisMonth: number;
    };
  };
  kpi: {
    campaignActiveRate: number;
    campaignCompletionRate: number;
    researchCompletionRate: number;
  };
}

/**
 * Get dashboard analytics (includes recent activity)
 */
export function useDashboardAnalytics(workspaceId: string, days: number = 30) {
  return useQuery({
    queryKey: ['crm', 'analytics', 'dashboard', workspaceId, days],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        days: days.toString(),
      });

      const response = await fetch(
        `/api/v1/crm/analytics/dashboard?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch dashboard analytics' });
        throw new Error(errorText || 'Failed to fetch dashboard analytics');
      }

      return response.json() as Promise<DashboardAnalytics>;
    },
    enabled: !!workspaceId,
    staleTime: 30000, // Cache for 30 seconds
    // Real-time updates via SSE stream (useAnalyticsMetricsStream), no polling needed
    retry: 2, // Limit retries to prevent infinite loops
  });
}

/**
 * Get recent activity timeline
 */
export function useActivityTimeline(workspaceId: string, limit: number = 10) {
  const { data: dashboardData, isLoading, error } = useDashboardAnalytics(workspaceId);

  return {
    data: dashboardData?.recentActivity || [],
    isLoading,
    error,
  };
}
