/**
 * React Query Hooks for AI Analytics API
 * Provides hooks for tool usage, costs, performance, sessions, and real-time streaming
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface DateRange {
  start?: string;
  end?: string;
}

export interface ToolUsageStat {
  toolName: string;
  invocations: number;
  successRate: number;
  avgLatency: number;
  errorCount: number;
  rateLimitedCount: number;
}

export interface ToolTimeSeriesPoint {
  date: string;
  invocations: number;
}

export interface CostBreakdown {
  date: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  model: string;
}

export interface PerformanceMetric {
  toolName: string;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  errorRate: number;
  totalInvocations: number;
}

export interface SessionAudit {
  id: string;
  sessionId: string;
  prompt: string;
  status: 'active' | 'completed' | 'error';
  filesModified: string[];
  createdAt: string;
  conversationId: string;
}

export interface ToolUsageResponse {
  workspaceId: string;
  dateRange: any;
  stats: ToolUsageStat[];
}

export interface TimeSeriesResponse {
  series: ToolTimeSeriesPoint[];
}

export interface CostsResponse {
  workspaceId: string;
  dateRange: any;
  groupBy: string;
  summary: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  breakdown: CostBreakdown[];
}

export interface PerformanceResponse {
  workspaceId: string;
  dateRange: any;
  metrics: PerformanceMetric[];
}

export interface SessionsResponse {
  sessions: SessionAudit[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Fetch tool usage statistics
 */
export function useToolUsageStats(
  workspaceId: string,
  dateRange?: DateRange
) {
  return useQuery<ToolUsageResponse>({
    queryKey: ['ai-analytics', 'tools', workspaceId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.start) params.append('startDate', dateRange.start);
      if (dateRange?.end) params.append('endDate', dateRange.end);

      const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/ai/analytics/tools${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch tool usage: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

/**
 * Fetch tool usage time series
 */
export function useToolTimeSeries(
  workspaceId: string,
  dateRange?: DateRange,
  groupBy: 'day' | 'week' | 'month' = 'day'
) {
  return useQuery<TimeSeriesResponse>({
    queryKey: ['ai-analytics', 'tools', 'timeseries', workspaceId, dateRange, groupBy],
    queryFn: async () => {
      const params = new URLSearchParams({ groupBy });
      if (dateRange?.start) params.append('startDate', dateRange.start);
      if (dateRange?.end) params.append('endDate', dateRange.end);

      const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/ai/analytics/tools/timeseries?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch time series: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

/**
 * Fetch cost analytics
 */
export function useCostAnalytics(
  workspaceId: string,
  groupBy: 'day' | 'week' | 'month' = 'day',
  dateRange?: DateRange
) {
  return useQuery<CostsResponse>({
    queryKey: ['ai-analytics', 'costs', workspaceId, groupBy, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ groupBy });
      if (dateRange?.start) params.append('startDate', dateRange.start);
      if (dateRange?.end) params.append('endDate', dateRange.end);

      const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/ai/analytics/costs?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch costs: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

/**
 * Fetch performance metrics
 */
export function usePerformanceMetrics(workspaceId: string) {
  return useQuery<PerformanceResponse>({
    queryKey: ['ai-analytics', 'performance', workspaceId],
    queryFn: async () => {
      const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/ai/analytics/performance`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch performance: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

/**
 * Fetch session audit log with pagination
 */
export function useSessionAuditLog(
  workspaceId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: 'active' | 'completed' | 'error' | 'all';
  } = {}
) {
  const { limit = 50, offset = 0, status = 'all' } = options;

  return useQuery<SessionsResponse>({
    queryKey: ['ai-analytics', 'sessions', workspaceId, limit, offset, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (status !== 'all') {
        params.append('status', status);
      }

      const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/ai/analytics/sessions?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!workspaceId,
  });
}
