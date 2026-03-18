/**
 * useAiCallAnalytics Hook
 * Phase K: AI Call Analytics Dashboard
 *
 * TanStack Query hooks for AI call analytics data.
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export type Period = '7d' | '30d' | '90d' | 'all';

export interface AiCallMetrics {
  period: string;
  metrics: {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    avgDurationFormatted: string;
    totalDuration: number;
    totalDurationFormatted: string;
    totalCost: string;
  };
  outcomes: {
    interested: number;
    notInterested: number;
    callback: number;
    voicemail: number;
    noAnswer: number;
    failed: number;
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  leadQuality: {
    hot: number;
    warm: number;
    cold: number;
  };
  direction?: {
    inbound: number;
    outbound: number;
    identificationRate: number;
  };
}

export interface TrendDataPoint {
  date: string;
  total: number;
  interested: number;
  callback: number;
  failed: number;
  duration: number;
  cost: number;
}

export interface ScriptPerformance {
  id: string;
  name: string;
  purpose: string | null;
  calls: number;
  successRate: string;
  isDefault: boolean | null;
  isActive: boolean | null;
}

export interface OutcomeDistribution {
  outcome: string;
  count: number;
  percentage: number;
}

export interface DurationBucket {
  bucket: string;
  label: string;
  count: number;
  percentage: number;
}

export interface DurationStats {
  avg: number;
  avgFormatted: string;
  max: number;
  maxFormatted: string;
  min: number;
  minFormatted: string;
}

/**
 * Get AI call overview metrics
 */
export function useAiCallMetrics(workspaceId: string, period: Period = '30d') {
  return useQuery({
    queryKey: ['ai-calls', 'analytics', 'metrics', workspaceId, period],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, period });

      const response = await fetch(
        `/api/v1/crm/analytics/ai-calls?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch AI call metrics' });
        throw new Error(errorText || 'Failed to fetch AI call metrics');
      }

      return response.json() as Promise<AiCallMetrics>;
    },
    enabled: !!workspaceId,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get AI call trends (daily time series)
 */
export function useAiCallTrends(workspaceId: string, period: Period = '30d') {
  return useQuery({
    queryKey: ['ai-calls', 'analytics', 'trends', workspaceId, period],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, period });

      const response = await fetch(
        `/api/v1/crm/analytics/ai-calls/trends?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch AI call trends' });
        throw new Error(errorText || 'Failed to fetch AI call trends');
      }

      return response.json() as Promise<{ trends: TrendDataPoint[] }>;
    },
    enabled: !!workspaceId,
    staleTime: 60000,
  });
}

/**
 * Get script performance rankings
 */
export function useAiCallScriptPerformance(workspaceId: string, period: Period = '30d') {
  return useQuery({
    queryKey: ['ai-calls', 'analytics', 'scripts', workspaceId, period],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, period });

      const response = await fetch(
        `/api/v1/crm/analytics/ai-calls/scripts?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch script performance' });
        throw new Error(errorText || 'Failed to fetch script performance');
      }

      return response.json() as Promise<{ scripts: ScriptPerformance[] }>;
    },
    enabled: !!workspaceId,
    staleTime: 60000,
  });
}

/**
 * Get outcome distribution
 */
export function useAiCallOutcomes(workspaceId: string, period: Period = '30d') {
  return useQuery({
    queryKey: ['ai-calls', 'analytics', 'outcomes', workspaceId, period],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, period });

      const response = await fetch(
        `/api/v1/crm/analytics/ai-calls/outcomes?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch outcome distribution' });
        throw new Error(errorText || 'Failed to fetch outcome distribution');
      }

      return response.json() as Promise<{
        total: number;
        distribution: OutcomeDistribution[];
      }>;
    },
    enabled: !!workspaceId,
    staleTime: 60000,
  });
}

/**
 * Get duration distribution
 */
export function useAiCallDuration(workspaceId: string, period: Period = '30d') {
  return useQuery({
    queryKey: ['ai-calls', 'analytics', 'duration', workspaceId, period],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, period });

      const response = await fetch(
        `/api/v1/crm/analytics/ai-calls/duration?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch duration distribution' });
        throw new Error(errorText || 'Failed to fetch duration distribution');
      }

      return response.json() as Promise<{
        total: number;
        distribution: DurationBucket[];
        stats: DurationStats;
      }>;
    },
    enabled: !!workspaceId,
    staleTime: 60000,
  });
}
