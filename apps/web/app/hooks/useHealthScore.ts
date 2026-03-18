/**
 * useHealthScore Hook
 * React hooks for AI-powered lead health scoring
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRequest } from '~/lib/api';

export interface HealthFactors {
  engagement_score: number;
  responsiveness_score: number;
  activity_score: number;
  relationship_score: number;
}

export interface HealthScore {
  lead_id: string;
  health_score: number;
  health_status: 'critical' | 'at_risk' | 'healthy' | 'excellent';
  last_calculated_at: string;
  factors: HealthFactors;
  positive_factors: string[];
  risk_factors: string[];
  recommended_actions: string[];
}

export interface HealthHistoryPoint {
  calculated_at: string;
  health_score: number;
  health_status: string;
}

export interface AtRiskLead {
  lead_id: string;
  lead_name: string;
  health_score: number;
  health_status: string;
  risk_factors: string[];
  calculated_at: string;
}

export interface CalculateHealthRequest {
  leadId: string;
  workspaceId: string;
}

/**
 * Get health score for a specific lead
 */
export function useHealthScore(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'health', leadId, workspaceId],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/v1/crm/health/leads/${leadId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch health score: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if response contains an error (API returns 200 with error object)
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data as HealthScore;
    },
    enabled: !!leadId && !!workspaceId,
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Get health score history for trend analysis
 */
export function useHealthHistory(leadId: string, workspaceId: string, days: number = 30) {
  return useQuery({
    queryKey: ['crm', 'health', 'history', leadId, workspaceId, days],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/v1/crm/health/history/${leadId}?workspaceId=${workspaceId}&days=${days}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch health history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.history as HealthHistoryPoint[];
    },
    enabled: !!leadId && !!workspaceId,
  });
}

/**
 * Get at-risk leads for workspace
 */
export function useAtRiskLeads(workspaceId: string, limit: number = 10) {
  return useQuery({
    queryKey: ['crm', 'health', 'at-risk', workspaceId, limit],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/v1/crm/health/at-risk?workspaceId=${workspaceId}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch at-risk leads: ${response.statusText}`);
      }

      const data = await response.json();
      return data.leads as AtRiskLead[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Manually trigger health calculation
 */
export function useCalculateHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CalculateHealthRequest) => {
      const { leadId, workspaceId } = request;

      const response = await apiRequest(
        `/api/v1/crm/health/leads/${leadId}/calculate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to calculate health score');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Health Score Updated', { description: 'The lead health score has been recalculated.' });

      // Invalidate health score
      queryClient.invalidateQueries({
        queryKey: ['crm', 'health', variables.leadId, variables.workspaceId],
      });

      // Invalidate health history
      queryClient.invalidateQueries({
        queryKey: ['crm', 'health', 'history', variables.leadId, variables.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error('Calculation Failed', { description: error.message });
    },
  });
}

/**
 * Get health status color for UI
 */
export function getHealthStatusColor(
  status: 'critical' | 'at_risk' | 'healthy' | 'excellent'
): string {
  switch (status) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'at_risk':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'healthy':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'excellent':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  }
}

/**
 * Get health score badge color based on score (0-100)
 */
export function getHealthScoreColor(score: number): string {
  if (score >= 76) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  if (score >= 51) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  if (score >= 26) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
}

/**
 * Get health status label based on score
 */
export function getHealthStatusLabel(score: number): string {
  if (score >= 76) return 'Excellent';
  if (score >= 51) return 'Healthy';
  if (score >= 26) return 'At Risk';
  return 'Critical';
}

/**
 * Get trend direction from history
 */
export function getTrendDirection(history: HealthHistoryPoint[]): 'up' | 'down' | 'stable' {
  if (history.length < 2) return 'stable';

  const recent = history.slice(-7); // Last 7 data points
  const first = recent[0].health_score;
  const last = recent[recent.length - 1].health_score;

  const diff = last - first;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

/**
 * Get factor score color (0-100)
 */
export function getFactorScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
