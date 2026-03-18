/**
 * Performance Metrics Service
 * Calculates latency percentiles and performance metrics
 */

import { db, aiToolInvocations } from '@agios/db';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export interface PerformanceMetrics {
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
  slowestInvocations: Array<{
    id: string;
    duration: number;
    timestamp: string;
    status: string;
  }>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class PerformanceMetricsService {
  /**
   * Get performance metrics for a workspace
   */
  static async getMetrics(
    workspaceId: string,
    toolName?: string,
    dateRange?: DateRange
  ): Promise<PerformanceMetrics[]> {
    const conditions = [eq(aiToolInvocations.workspaceId, workspaceId)];

    if (toolName) {
      conditions.push(eq(aiToolInvocations.toolName, toolName));
    }

    if (dateRange) {
      conditions.push(gte(aiToolInvocations.createdAt, dateRange.startDate));
      conditions.push(lte(aiToolInvocations.createdAt, dateRange.endDate));
    }

    // Get all invocations grouped by tool name
    const toolGroups = await db
      .select({
        toolName: aiToolInvocations.toolName,
      })
      .from(aiToolInvocations)
      .where(and(...conditions))
      .groupBy(aiToolInvocations.toolName);

    const metrics: PerformanceMetrics[] = [];

    // Process each tool group
    for (const group of toolGroups) {
      const toolConditions = [...conditions, eq(aiToolInvocations.toolName, group.toolName)];

      // Get all durations for percentile calculation
      const durations = await db
        .select({
          durationMs: aiToolInvocations.durationMs,
        })
        .from(aiToolInvocations)
        .where(and(...toolConditions));

      const durationValues = durations
        .map((d) => d.durationMs)
        .filter((d): d is number => d !== null);

      // Calculate percentiles
      const latency = this.calculatePercentiles(durationValues);

      // Get error count and total invocations
      const stats = await db
        .select({
          totalInvocations: sql<number>`COUNT(*)::int`,
          errorCount: sql<number>`COUNT(CASE WHEN ${aiToolInvocations.status} = 'error' THEN 1 END)::int`,
        })
        .from(aiToolInvocations)
        .where(and(...toolConditions));

      const totalInvocations = stats[0]?.totalInvocations || 0;
      const errorCount = stats[0]?.errorCount || 0;
      const errorRate = totalInvocations > 0 ? errorCount / totalInvocations : 0;

      // Get slowest invocations (top 10)
      const slowest = await db
        .select({
          id: aiToolInvocations.id,
          duration: aiToolInvocations.durationMs,
          timestamp: aiToolInvocations.createdAt,
          status: aiToolInvocations.status,
        })
        .from(aiToolInvocations)
        .where(and(...toolConditions))
        .orderBy(desc(aiToolInvocations.durationMs))
        .limit(10);

      metrics.push({
        toolName: group.toolName,
        latency,
        errorRate,
        totalInvocations,
        slowestInvocations: slowest.map((s) => ({
          id: s.id,
          duration: s.duration || 0,
          timestamp: s.timestamp.toISOString(),
          status: s.status,
        })),
      });
    }

    return metrics;
  }

  /**
   * Calculate percentiles from an array of values
   */
  static calculatePercentiles(values: number[]): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;

    return {
      p50: sorted[p50Index],
      p95: sorted[p95Index],
      p99: sorted[p99Index],
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }
}
