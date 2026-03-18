/**
 * Analytics Service
 * Main orchestration for AI assistant analytics
 */

import { db, aiToolInvocations, aiMessages, aiConversations } from '@agios/db';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export interface ToolUsageStats {
  toolName: string;
  invocations: number;
  successRate: number;
  avgLatency: number;
  errorCount: number;
  rateLimitedCount: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface TimeSeriesData {
  date: string;
  toolName: string;
  invocations: number;
  successCount: number;
  errorCount: number;
  avgLatency: number;
}

export class AnalyticsService {
  /**
   * Get tool usage statistics for a workspace
   */
  static async getToolUsageStats(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<ToolUsageStats[]> {
    const conditions = [eq(aiToolInvocations.workspaceId, workspaceId)];

    if (dateRange) {
      conditions.push(gte(aiToolInvocations.createdAt, dateRange.startDate));
      conditions.push(lte(aiToolInvocations.createdAt, dateRange.endDate));
    }

    const results = await db
      .select({
        toolName: aiToolInvocations.toolName,
        invocations: sql<number>`COUNT(*)::int`,
        successCount: sql<number>`COUNT(CASE WHEN ${aiToolInvocations.status} = 'success' THEN 1 END)::int`,
        errorCount: sql<number>`COUNT(CASE WHEN ${aiToolInvocations.status} = 'error' THEN 1 END)::int`,
        rateLimitedCount: sql<number>`COUNT(CASE WHEN ${aiToolInvocations.status} = 'rate_limited' THEN 1 END)::int`,
        avgLatency: sql<number>`COALESCE(AVG(${aiToolInvocations.durationMs}), 0)::float`,
      })
      .from(aiToolInvocations)
      .where(and(...conditions))
      .groupBy(aiToolInvocations.toolName);

    return results.map((row) => ({
      toolName: row.toolName,
      invocations: row.invocations,
      successRate: row.invocations > 0 ? row.successCount / row.invocations : 0,
      avgLatency: row.avgLatency,
      errorCount: row.errorCount,
      rateLimitedCount: row.rateLimitedCount,
    }));
  }

  /**
   * Get time-series data for charting
   */
  static async getToolUsageTimeSeries(
    workspaceId: string,
    dateRange?: DateRange,
    toolName?: string
  ): Promise<TimeSeriesData[]> {
    const conditions = [eq(aiToolInvocations.workspaceId, workspaceId)];

    if (dateRange) {
      conditions.push(gte(aiToolInvocations.createdAt, dateRange.startDate));
      conditions.push(lte(aiToolInvocations.createdAt, dateRange.endDate));
    }

    if (toolName) {
      conditions.push(eq(aiToolInvocations.toolName, toolName));
    }

    const results = await db
      .select({
        date: sql<string>`DATE(${aiToolInvocations.createdAt})`,
        toolName: aiToolInvocations.toolName,
        invocations: sql<number>`COUNT(*)::int`,
        successCount: sql<number>`COUNT(CASE WHEN ${aiToolInvocations.status} = 'success' THEN 1 END)::int`,
        errorCount: sql<number>`COUNT(CASE WHEN ${aiToolInvocations.status} = 'error' THEN 1 END)::int`,
        avgLatency: sql<number>`COALESCE(AVG(${aiToolInvocations.durationMs}), 0)::float`,
      })
      .from(aiToolInvocations)
      .where(and(...conditions))
      .groupBy(sql`DATE(${aiToolInvocations.createdAt})`, aiToolInvocations.toolName)
      .orderBy(sql`DATE(${aiToolInvocations.createdAt}) DESC`);

    return results.map((row) => ({
      date: row.date,
      toolName: row.toolName,
      invocations: row.invocations,
      successCount: row.successCount,
      errorCount: row.errorCount,
      avgLatency: row.avgLatency,
    }));
  }
}
