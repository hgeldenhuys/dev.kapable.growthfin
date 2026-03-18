/**
 * Session Metrics Types
 * US-001: Add session metrics dashboard
 *
 * Types for session metrics computed from hook_events
 */

/**
 * Time range options for metrics queries
 */
export type TimeRange = '1h' | '8h' | '24h' | '7d' | '30d';

/**
 * Session metric summary for a single session
 */
export interface SessionMetric {
  sessionId: string;
  sessionName?: string;          // User-friendly name (from payload metadata)
  projectId: string;
  agentType?: string;            // Current or last agent type
  startedAt: Date;               // First event timestamp
  lastActivityAt: Date;          // Most recent event timestamp
  durationMs: number;            // Time between first and last event
  eventCount: number;            // Total hook events
  toolUsage: Record<string, number>;  // Tool name -> usage count
  todoStats: {
    completed: number;
    inProgress: number;
    pending: number;
  };
  summary?: string;              // First user prompt (truncated)
}

/**
 * Aggregated metrics across all sessions
 */
export interface SessionMetricsAggregate {
  totalSessions: number;
  activeSessions: number;        // Sessions with activity in last 30 minutes
  avgDurationMs: number;
  totalDurationMs: number;
  topTools: Array<{ name: string; count: number }>;
  sessionsByAgentType: Record<string, number>;
  recentSessions: SessionMetric[];
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolName: string;
  totalUsage: number;
  sessionCount: number;          // How many sessions used this tool
  avgUsagePerSession: number;
}

/**
 * Duration analytics
 */
export interface DurationAnalytics {
  avgDurationMs: number;
  medianDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  totalDurationMs: number;
  p90DurationMs: number;         // 90th percentile
}

/**
 * Query options for session metrics
 */
export interface GetSessionsOptions {
  projectId?: string;
  agentType?: string;
  timeRange?: TimeRange;
  limit?: number;
}

/**
 * Query options for aggregated metrics
 */
export interface GetAggregateOptions {
  projectId?: string;
  timeRange?: TimeRange;
}

/**
 * Query options for tool usage stats
 */
export interface GetToolUsageOptions {
  projectId?: string;
  timeRange?: TimeRange;
  limit?: number;
}

/**
 * Query options for duration analytics
 */
export interface GetDurationOptions {
  projectId?: string;
  timeRange?: TimeRange;
}

/**
 * Raw session data from database query
 */
export interface RawSessionData {
  sessionId: string;
  projectId: string;
  agentType: string | null;
  firstEvent: Date;
  lastEvent: Date;
  eventCount: number;
}

/**
 * Raw tool usage data from database query
 */
export interface RawToolData {
  sessionId: string;
  toolName: string;
  count: number;
}
