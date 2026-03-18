/**
 * Context Usage Service
 * Business logic for extracting and aggregating context usage from Stop events
 *
 * Data source: hook_events table where event_name = 'Stop'
 * Usage path: payload.conversation.message.usage
 *
 * CRITICAL: No new tables - uses existing hook_events data only
 */

import type { Database } from '@agios/db';
import { hookEvents } from '@agios/db';
import { desc, gte, eq, and, sql, inArray } from 'drizzle-orm';
import type {
  ContextUsageMetrics,
  ContextUsageSummary,
  GetRecentOptions,
  GetSummaryOptions,
  RawUsageData,
  TimeRange,
} from './types';

// Context limit constant (200k tokens)
const CONTEXT_LIMIT = 200000;

/**
 * Convert time range to milliseconds
 */
function timeRangeToMs(timeRange: TimeRange): number {
  const ranges: Record<TimeRange, number> = {
    '1h': 1 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return ranges[timeRange];
}

/**
 * Extract raw usage data from Stop events
 */
async function extractRawUsage(
  db: Database,
  options: GetRecentOptions
): Promise<RawUsageData[]> {
  const timeRange = options.timeRange || '8h';
  const since = new Date(Date.now() - timeRangeToMs(timeRange));

  // Build where conditions
  const conditions = [
    eq(hookEvents.eventName, 'Stop'),
    gte(hookEvents.createdAt, since),
  ];

  if (options.projectId) {
    conditions.push(eq(hookEvents.projectId, options.projectId));
  }

  // Query hook_events for Stop events with usage data
  const results = await db
    .select({
      sessionId: hookEvents.sessionId,
      projectId: hookEvents.projectId,
      usage: sql<any>`${hookEvents.payload}->'conversation'->'message'->'usage'`.as('usage'),
      createdAt: hookEvents.createdAt,
    })
    .from(hookEvents)
    .where(and(...conditions))
    .orderBy(desc(hookEvents.createdAt));

  // Transform results to RawUsageData
  const rawData: RawUsageData[] = [];

  for (const row of results) {
    const usage = row['usage'];

    // Skip if usage data is missing
    if (!usage) continue;

    rawData.push({
      sessionId: row['sessionId'] as string,
      projectId: row['projectId'] as string,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens: usage.cache_read_input_tokens || 0,
      createdAt: row['createdAt'] as Date,
    });
  }

  return rawData;
}

/**
 * Fetch session summaries from first UserPromptSubmit event
 */
async function fetchSessionSummaries(
  db: Database,
  sessionIds: string[],
  projectId?: string
): Promise<Map<string, string>> {
  if (sessionIds.length === 0) return new Map();

  // Build where conditions
  const conditions = [
    eq(hookEvents.eventName, 'UserPromptSubmit'),
    inArray(hookEvents.sessionId, sessionIds),
  ];

  if (projectId) {
    conditions.push(eq(hookEvents.projectId, projectId));
  }

  // Query for first UserPromptSubmit per session
  const results = await db
    .select({
      sessionId: hookEvents.sessionId,
      prompt: sql<string>`${hookEvents.payload}->'event'->>'prompt'`.as('prompt'),
      createdAt: hookEvents.createdAt,
    })
    .from(hookEvents)
    .where(and(...conditions))
    .orderBy(hookEvents.createdAt);

  // Build map of sessionId -> summary (first prompt only)
  const summaryMap = new Map<string, string>();

  for (const row of results) {
    const sessionId = row['sessionId'] as string;
    const prompt = row['prompt'];

    // Only use first prompt for each session
    if (!summaryMap.has(sessionId) && prompt && prompt.trim().length > 0) {
      // Truncate to 100 characters max
      const truncated = prompt.length > 100
        ? prompt.substring(0, 97) + '...'
        : prompt;
      summaryMap.set(sessionId, truncated);
    }
  }

  return summaryMap;
}

/**
 * Aggregate raw usage data by session
 */
async function aggregateBySession(
  db: Database,
  rawData: RawUsageData[],
  projectId?: string
): Promise<ContextUsageMetrics[]> {
  // Group by session
  const sessionMap = new Map<string, {
    projectId: string;
    lastActivity: Date;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    conversationTurns: number;
  }>();

  for (const data of rawData) {
    const existing = sessionMap.get(data.sessionId);

    if (existing) {
      // Aggregate tokens
      existing.inputTokens += data.inputTokens;
      existing.outputTokens += data.outputTokens;
      existing.cachedTokens += data.cachedTokens;
      existing.conversationTurns += 1;

      // Update last activity if more recent
      if (data.createdAt > existing.lastActivity) {
        existing.lastActivity = data.createdAt;
      }
    } else {
      // Initialize new session
      sessionMap.set(data.sessionId, {
        projectId: data.projectId,
        lastActivity: data.createdAt,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cachedTokens: data.cachedTokens,
        conversationTurns: 1,
      });
    }
  }

  // Fetch summaries for all sessions
  const sessionIds = Array.from(sessionMap.keys());
  const summaries = await fetchSessionSummaries(db, sessionIds, projectId);

  // Convert map to ContextUsageMetrics array
  const metrics: ContextUsageMetrics[] = [];

  for (const [sessionId, data] of sessionMap.entries()) {
    const totalTokens = data.inputTokens + data.outputTokens + data.cachedTokens;
    const percentageUsed = (totalTokens / CONTEXT_LIMIT) * 100;

    metrics.push({
      sessionId,
      projectId: data.projectId,
      lastActivity: data.lastActivity,
      metrics: {
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cachedTokens: data.cachedTokens,
        totalTokens,
        percentageUsed: Math.round(percentageUsed * 100) / 100, // Round to 2 decimals
      },
      conversationTurns: data.conversationTurns,
      summary: summaries.get(sessionId), // Optional summary
    });
  }

  // Sort by last activity (most recent first)
  metrics.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return metrics;
}

/**
 * Context Usage Service
 */
export const contextUsageService = {
  /**
   * Get usage for recent sessions (last 7 days default)
   *
   * @param db Database instance
   * @param options Query options (projectId, timeRange, limit)
   * @returns Array of session usage metrics
   */
  async getRecent(
    db: Database,
    options: GetRecentOptions = {}
  ): Promise<ContextUsageMetrics[]> {
    // Extract raw usage data from Stop events
    const rawData = await extractRawUsage(db, options);

    // Aggregate by session (with summaries)
    let metrics = await aggregateBySession(db, rawData, options.projectId);

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      metrics = metrics.slice(0, options.limit);
    }

    return metrics;
  },

  /**
   * Get usage for specific session
   *
   * @param db Database instance
   * @param sessionId Session ID
   * @param projectId Project ID
   * @returns Session usage metrics or null if not found
   */
  async getBySessionId(
    db: Database,
    sessionId: string,
    projectId: string
  ): Promise<ContextUsageMetrics | null> {
    // Query all Stop events for this session
    const results = await db
      .select({
        sessionId: hookEvents.sessionId,
        projectId: hookEvents.projectId,
        usage: sql<any>`${hookEvents.payload}->'conversation'->'message'->'usage'`.as('usage'),
        createdAt: hookEvents.createdAt,
      })
      .from(hookEvents)
      .where(
        and(
          eq(hookEvents.eventName, 'Stop'),
          eq(hookEvents.sessionId, sessionId),
          eq(hookEvents.projectId, projectId)
        )
      )
      .orderBy(desc(hookEvents.createdAt));

    if (results.length === 0) {
      return null;
    }

    // Transform to RawUsageData
    const rawData: RawUsageData[] = [];
    for (const row of results) {
      const usage = row['usage'];
      if (!usage) continue;

      rawData.push({
        sessionId: row['sessionId'] as string,
        projectId: row['projectId'] as string,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cachedTokens: usage.cache_read_input_tokens || 0,
        createdAt: row['createdAt'] as Date,
      });
    }

    // Aggregate (with summaries)
    const metrics = await aggregateBySession(db, rawData, projectId);

    return metrics.length > 0 ? metrics[0] : null;
  },

  /**
   * Calculate summary statistics
   *
   * @param db Database instance
   * @param options Query options (projectId, timeRange)
   * @returns Summary statistics
   */
  async getSummary(
    db: Database,
    options: GetSummaryOptions = {}
  ): Promise<ContextUsageSummary> {
    // Get all recent metrics
    const metrics = await this.getRecent(db, {
      projectId: options.projectId,
      timeRange: options.timeRange || '7d',
    });

    if (metrics.length === 0) {
      return {
        totalSessions: 0,
        avgTokensPerSession: 0,
        cacheHitRate: 0,
      };
    }

    // Calculate totals
    let totalTokensAcrossAllSessions = 0;
    let totalCachedTokens = 0;
    let totalNonCachedTokens = 0;

    for (const metric of metrics) {
      totalTokensAcrossAllSessions += metric.metrics.totalTokens;
      totalCachedTokens += metric.metrics.cachedTokens;
      totalNonCachedTokens += metric.metrics.inputTokens + metric.metrics.outputTokens;
    }

    const avgTokensPerSession = totalTokensAcrossAllSessions / metrics.length;

    // Cache hit rate: cachedTokens / (cachedTokens + nonCachedTokens) * 100
    const totalTokensIncludingCache = totalCachedTokens + totalNonCachedTokens;
    const cacheHitRate = totalTokensIncludingCache > 0
      ? (totalCachedTokens / totalTokensIncludingCache) * 100
      : 0;

    return {
      totalSessions: metrics.length,
      avgTokensPerSession: Math.round(avgTokensPerSession),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100, // Round to 2 decimals
    };
  },
};
