/**
 * Context Usage Types
 * Interfaces for context usage tracking and aggregation
 */

/**
 * Time range options for usage queries
 */
export type TimeRange = '1h' | '8h' | '24h' | '7d' | '30d';

/**
 * Context usage metrics for a single session
 */
export interface ContextUsageMetrics {
  sessionId: string;
  projectId: string;
  lastActivity: Date;
  metrics: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number; // cache_read_input_tokens
    totalTokens: number; // Sum of all
    percentageUsed: number; // (total / 200000) * 100
  };
  conversationTurns: number; // Count of Stop events
  summary?: string; // Optional summary/description from first user message
}

/**
 * Summary statistics across multiple sessions
 */
export interface ContextUsageSummary {
  totalSessions: number;
  avgTokensPerSession: number;
  cacheHitRate: number; // (cachedTokens / totalTokens) * 100
}

/**
 * Options for querying recent context usage
 */
export interface GetRecentOptions {
  projectId?: string;
  timeRange?: TimeRange;
  limit?: number;
}

/**
 * Options for calculating usage summary
 */
export interface GetSummaryOptions {
  projectId?: string;
  timeRange?: TimeRange;
}

/**
 * Raw usage data extracted from Stop event payload
 */
export interface RawUsageData {
  sessionId: string;
  projectId: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  createdAt: Date;
}
