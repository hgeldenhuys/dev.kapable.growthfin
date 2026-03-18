/**
 * Session Metrics Service
 * US-001: Add session metrics dashboard
 *
 * Computes session metrics from hook_events and claude_sessions tables.
 * No new tables - all metrics computed on query for real-time accuracy.
 */

import type { Database } from '@agios/db';
import { hookEvents, claudeSessions } from '@agios/db';
import { desc, gte, eq, and, sql, count, min, max, inArray } from 'drizzle-orm';
import type {
  SessionMetric,
  SessionMetricsAggregate,
  ToolUsageStats,
  DurationAnalytics,
  GetSessionsOptions,
  GetAggregateOptions,
  GetToolUsageOptions,
  GetDurationOptions,
  TimeRange,
} from './types';

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
 * Fetch first user prompt for each session (for summary)
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
    const sessionId = row.sessionId as string;
    const prompt = row.prompt;

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
 * Fetch tool usage counts for each session
 */
async function fetchToolUsage(
  db: Database,
  sessionIds: string[],
  projectId?: string
): Promise<Map<string, Record<string, number>>> {
  if (sessionIds.length === 0) return new Map();

  // Build where conditions
  const conditions = [
    eq(hookEvents.eventName, 'PreToolUse'),
    inArray(hookEvents.sessionId, sessionIds),
  ];

  if (projectId) {
    conditions.push(eq(hookEvents.projectId, projectId));
  }

  // Query tool usage by session
  const results = await db
    .select({
      sessionId: hookEvents.sessionId,
      toolName: hookEvents.toolName,
      count: count(),
    })
    .from(hookEvents)
    .where(and(...conditions))
    .groupBy(hookEvents.sessionId, hookEvents.toolName);

  // Build map of sessionId -> { toolName -> count }
  const usageMap = new Map<string, Record<string, number>>();

  for (const row of results) {
    const sessionId = row.sessionId as string;
    const toolName = row.toolName as string;
    const cnt = Number(row.count);

    if (!usageMap.has(sessionId)) {
      usageMap.set(sessionId, {});
    }

    const sessionUsage = usageMap.get(sessionId)!;
    sessionUsage[toolName] = (sessionUsage[toolName] || 0) + cnt;
  }

  return usageMap;
}

/**
 * Fetch todo stats from claude_sessions
 */
async function fetchTodoStats(
  db: Database,
  sessionIds: string[]
): Promise<Map<string, { completed: number; inProgress: number; pending: number }>> {
  if (sessionIds.length === 0) return new Map();

  const results = await db
    .select({
      id: claudeSessions.id,
      todos: claudeSessions.todos,
    })
    .from(claudeSessions)
    .where(inArray(claudeSessions.id, sessionIds));

  const statsMap = new Map<string, { completed: number; inProgress: number; pending: number }>();

  for (const row of results) {
    const sessionId = row.id;
    const todos = row.todos || [];

    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    for (const todo of todos) {
      if (todo.status === 'completed') completed++;
      else if (todo.status === 'in_progress') inProgress++;
      else if (todo.status === 'pending') pending++;
    }

    statsMap.set(sessionId, { completed, inProgress, pending });
  }

  return statsMap;
}

/**
 * Session Metrics Service
 */
export const sessionMetricsService = {
  /**
   * Get recent sessions with metrics
   */
  async getSessions(
    db: Database,
    options: GetSessionsOptions = {}
  ): Promise<SessionMetric[]> {
    const timeRange = options.timeRange || '7d';
    const since = new Date(Date.now() - timeRangeToMs(timeRange));

    // Build where conditions
    const conditions = [gte(hookEvents.createdAt, since)];

    if (options.projectId) {
      conditions.push(eq(hookEvents.projectId, options.projectId));
    }

    if (options.agentType) {
      conditions.push(eq(hookEvents.agentType, options.agentType));
    }

    // Query session aggregates from hook_events
    const sessionResults = await db
      .select({
        sessionId: hookEvents.sessionId,
        projectId: hookEvents.projectId,
        agentType: hookEvents.agentType,
        firstEvent: min(hookEvents.createdAt),
        lastEvent: max(hookEvents.createdAt),
        eventCount: count(),
      })
      .from(hookEvents)
      .where(and(...conditions))
      .groupBy(hookEvents.sessionId, hookEvents.projectId, hookEvents.agentType)
      .orderBy(desc(max(hookEvents.createdAt)));

    // Apply limit
    const limitedResults = options.limit && options.limit > 0
      ? sessionResults.slice(0, options.limit)
      : sessionResults;

    if (limitedResults.length === 0) {
      return [];
    }

    // Extract session IDs
    const sessionIds = limitedResults.map(r => r.sessionId as string);

    // Fetch additional data in parallel
    const [summaries, toolUsage, todoStats] = await Promise.all([
      fetchSessionSummaries(db, sessionIds, options.projectId),
      fetchToolUsage(db, sessionIds, options.projectId),
      fetchTodoStats(db, sessionIds),
    ]);

    // Build SessionMetric array
    const metrics: SessionMetric[] = [];

    for (const row of limitedResults) {
      const sessionId = row.sessionId as string;
      const firstEvent = row.firstEvent as Date;
      const lastEvent = row.lastEvent as Date;
      const durationMs = lastEvent.getTime() - firstEvent.getTime();

      metrics.push({
        sessionId,
        projectId: row.projectId as string,
        agentType: row.agentType as string | undefined,
        startedAt: firstEvent,
        lastActivityAt: lastEvent,
        durationMs,
        eventCount: Number(row.eventCount),
        toolUsage: toolUsage.get(sessionId) || {},
        todoStats: todoStats.get(sessionId) || { completed: 0, inProgress: 0, pending: 0 },
        summary: summaries.get(sessionId),
      });
    }

    return metrics;
  },

  /**
   * Get aggregated metrics across all sessions
   */
  async getAggregate(
    db: Database,
    options: GetAggregateOptions = {}
  ): Promise<SessionMetricsAggregate> {
    // Get all sessions for the time range
    const sessions = await this.getSessions(db, {
      projectId: options.projectId,
      timeRange: options.timeRange,
    });

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        avgDurationMs: 0,
        totalDurationMs: 0,
        topTools: [],
        sessionsByAgentType: {},
        recentSessions: [],
      };
    }

    // Calculate totals
    let totalDurationMs = 0;
    const now = Date.now();
    const activeThreshold = 30 * 60 * 1000; // 30 minutes
    let activeSessions = 0;

    // Aggregate tool usage across all sessions
    const totalToolUsage: Record<string, number> = {};

    // Count sessions by agent type
    const sessionsByAgentType: Record<string, number> = {};

    for (const session of sessions) {
      totalDurationMs += session.durationMs;

      // Check if active (last activity within 30 minutes)
      if (now - session.lastActivityAt.getTime() < activeThreshold) {
        activeSessions++;
      }

      // Aggregate tool usage
      for (const [tool, cnt] of Object.entries(session.toolUsage)) {
        totalToolUsage[tool] = (totalToolUsage[tool] || 0) + cnt;
      }

      // Count by agent type
      const agentType = session.agentType || 'main';
      sessionsByAgentType[agentType] = (sessionsByAgentType[agentType] || 0) + 1;
    }

    // Sort tools by usage
    const topTools = Object.entries(totalToolUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, cnt]) => ({ name, count: cnt }));

    const avgDurationMs = totalDurationMs / sessions.length;

    return {
      totalSessions: sessions.length,
      activeSessions,
      avgDurationMs: Math.round(avgDurationMs),
      totalDurationMs,
      topTools,
      sessionsByAgentType,
      recentSessions: sessions.slice(0, 5),
    };
  },

  /**
   * Get tool usage statistics
   */
  async getToolUsageStats(
    db: Database,
    options: GetToolUsageOptions = {}
  ): Promise<ToolUsageStats[]> {
    const timeRange = options.timeRange || '7d';
    const since = new Date(Date.now() - timeRangeToMs(timeRange));

    // Build where conditions
    const conditions = [
      eq(hookEvents.eventName, 'PreToolUse'),
      gte(hookEvents.createdAt, since),
    ];

    if (options.projectId) {
      conditions.push(eq(hookEvents.projectId, options.projectId));
    }

    // Query tool usage
    const results = await db
      .select({
        toolName: hookEvents.toolName,
        totalUsage: count(),
        sessionCount: sql<number>`COUNT(DISTINCT ${hookEvents.sessionId})`.as('session_count'),
      })
      .from(hookEvents)
      .where(and(...conditions))
      .groupBy(hookEvents.toolName)
      .orderBy(desc(count()));

    // Apply limit
    const limitedResults = options.limit && options.limit > 0
      ? results.slice(0, options.limit)
      : results;

    return limitedResults.map(row => ({
      toolName: row.toolName as string,
      totalUsage: Number(row.totalUsage),
      sessionCount: Number(row.sessionCount),
      avgUsagePerSession: Number(row.sessionCount) > 0
        ? Number(row.totalUsage) / Number(row.sessionCount)
        : 0,
    }));
  },

  /**
   * Get duration analytics
   */
  async getDurationAnalytics(
    db: Database,
    options: GetDurationOptions = {}
  ): Promise<DurationAnalytics> {
    // Get all sessions
    const sessions = await this.getSessions(db, {
      projectId: options.projectId,
      timeRange: options.timeRange,
    });

    if (sessions.length === 0) {
      return {
        avgDurationMs: 0,
        medianDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        totalDurationMs: 0,
        p90DurationMs: 0,
      };
    }

    // Extract durations and sort
    const durations = sessions.map(s => s.durationMs).sort((a, b) => a - b);

    const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
    const avgDurationMs = totalDurationMs / durations.length;

    // Calculate median
    const midIndex = Math.floor(durations.length / 2);
    const medianDurationMs = durations.length % 2 === 0
      ? (durations[midIndex - 1] + durations[midIndex]) / 2
      : durations[midIndex];

    // Calculate p90
    const p90Index = Math.floor(durations.length * 0.9);
    const p90DurationMs = durations[p90Index] || durations[durations.length - 1];

    return {
      avgDurationMs: Math.round(avgDurationMs),
      medianDurationMs: Math.round(medianDurationMs),
      minDurationMs: durations[0],
      maxDurationMs: durations[durations.length - 1],
      totalDurationMs,
      p90DurationMs: Math.round(p90DurationMs),
    };
  },
};
