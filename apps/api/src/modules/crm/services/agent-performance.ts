/**
 * Agent Performance Service
 * Business logic for calculating agent performance metrics
 * US-AGENT-005: Agent Performance Metrics API
 */

import type { Database } from '@agios/db';
import { crmActivities, crmLeads, crmOpportunities } from '@agios/db';
import { eq, and, gte, lte, isNull, sql, count, avg } from 'drizzle-orm';

export interface AgentPerformanceQuery {
  workspaceId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
}

export interface AgentPerformanceMetrics {
  callsMade: number;
  contactRate: number; // (RPC / Total) * 100
  conversionRate: number; // (Qualified / RPC) * 100
  avgCallDuration: number; // seconds
  callbacksScheduled: number;
  opportunitiesCreated: number;

  // Team comparison (anonymized)
  teamAvgContactRate: number;
  teamAvgConversionRate: number;

  // Trends (last 7 days)
  dailyCallsLast7Days: number[];
  conversionRateLast7Days: number[];
}

export const agentPerformanceService = {
  /**
   * Calculate comprehensive agent performance metrics
   * Optimized to complete in <2 seconds
   */
  async calculate(db: Database, query: AgentPerformanceQuery): Promise<AgentPerformanceMetrics> {
    const { workspaceId, userId, startDate, endDate } = query;

    // Parallel query execution for performance
    const [
      callMetrics,
      teamMetrics,
      callbacksResult,
      opportunitiesResult,
      dailyCallsData,
      dailyConversionsData,
    ] = await Promise.all([
      // Query 1: Call metrics for this user
      this.getUserCallMetrics(db, workspaceId, userId, startDate, endDate),

      // Query 2: Team-wide metrics for comparison
      this.getTeamCallMetrics(db, workspaceId, startDate, endDate),

      // Query 3: Callbacks scheduled
      this.getCallbacksScheduled(db, workspaceId, userId, startDate, endDate),

      // Query 4: Opportunities created
      this.getOpportunitiesCreated(db, workspaceId, userId, startDate, endDate),

      // Query 5: Daily calls (last 7 days)
      this.getDailyCalls(db, workspaceId, userId),

      // Query 6: Daily conversion rates (last 7 days)
      this.getDailyConversions(db, workspaceId, userId),
    ]);

    // Calculate contact rate
    const totalCalls = callMetrics.total;
    const rpcCalls = callMetrics.rpc;
    const qualifiedLeads = callMetrics.qualified;

    const contactRate = totalCalls > 0 ? (rpcCalls / totalCalls) * 100 : 0;
    const conversionRate = rpcCalls > 0 ? (qualifiedLeads / rpcCalls) * 100 : 0;

    // Calculate team averages
    const teamContactRate = teamMetrics.totalCalls > 0
      ? (teamMetrics.rpcCalls / teamMetrics.totalCalls) * 100
      : 0;
    const teamConversionRate = teamMetrics.rpcCalls > 0
      ? (teamMetrics.qualifiedLeads / teamMetrics.rpcCalls) * 100
      : 0;

    return {
      callsMade: totalCalls,
      contactRate: Math.round(contactRate * 100) / 100, // Round to 2 decimals
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgCallDuration: callMetrics.avgDuration,
      callbacksScheduled: callbacksResult.count,
      opportunitiesCreated: opportunitiesResult.count,

      teamAvgContactRate: Math.round(teamContactRate * 100) / 100,
      teamAvgConversionRate: Math.round(teamConversionRate * 100) / 100,

      dailyCallsLast7Days: dailyCallsData,
      conversionRateLast7Days: dailyConversionsData,
    };
  },

  /**
   * Get user call metrics: total calls, RPC calls, qualified leads, avg duration
   */
  async getUserCallMetrics(
    db: Database,
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    rpc: number;
    qualified: number;
    avgDuration: number;
  }> {
    // Total calls by this user
    const totalResult = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt)
        )
      );

    const total = totalResult[0]?.count || 0;

    // RPC calls (disposition = rpc_interested or rpc_not_interested)
    const rpcResult = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt),
          sql`${crmActivities.disposition} IN ('rpc_interested', 'rpc_not_interested')`
        )
      );

    const rpc = rpcResult[0]?.count || 0;

    // Qualified leads (leads moved to qualified status by this user's activities)
    // We need to count leads that have activities with disposition = rpc_interested
    const qualifiedResult = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          eq(crmActivities.disposition, 'rpc_interested'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt)
        )
      );

    const qualified = qualifiedResult[0]?.count || 0;

    // Average call duration (in seconds)
    const avgDurationResult = await db
      .select({ avgDuration: avg(crmActivities.duration) })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt)
        )
      );

    const avgDuration = Math.round(Number(avgDurationResult[0]?.avgDuration || 0));

    return {
      total,
      rpc,
      qualified,
      avgDuration,
    };
  },

  /**
   * Get team-wide call metrics for comparison (anonymized)
   */
  async getTeamCallMetrics(
    db: Database,
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCalls: number;
    rpcCalls: number;
    qualifiedLeads: number;
  }> {
    // Total calls by all users in workspace
    const totalResult = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt)
        )
      );

    const totalCalls = totalResult[0]?.count || 0;

    // RPC calls by all users
    const rpcResult = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt),
          sql`${crmActivities.disposition} IN ('rpc_interested', 'rpc_not_interested')`
        )
      );

    const rpcCalls = rpcResult[0]?.count || 0;

    // Qualified leads by all users
    const qualifiedResult = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          eq(crmActivities.disposition, 'rpc_interested'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt)
        )
      );

    const qualifiedLeads = qualifiedResult[0]?.count || 0;

    return {
      totalCalls,
      rpcCalls,
      qualifiedLeads,
    };
  },

  /**
   * Get callbacks scheduled count
   */
  async getCallbacksScheduled(
    db: Database,
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ count: number }> {
    const result = await db
      .select({ count: count() })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.disposition, 'callback_scheduled'),
          gte(crmActivities.createdAt, startDate),
          lte(crmActivities.createdAt, endDate),
          isNull(crmActivities.deletedAt)
        )
      );

    return { count: result[0]?.count || 0 };
  },

  /**
   * Get opportunities created count
   */
  async getOpportunitiesCreated(
    db: Database,
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ count: number }> {
    const result = await db
      .select({ count: count() })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.workspaceId, workspaceId),
          eq(crmOpportunities.createdBy, userId),
          gte(crmOpportunities.createdAt, startDate),
          lte(crmOpportunities.createdAt, endDate),
          isNull(crmOpportunities.deletedAt)
        )
      );

    return { count: result[0]?.count || 0 };
  },

  /**
   * Get daily calls for last 7 days
   * Returns array of 7 numbers (oldest to newest)
   */
  async getDailyCalls(
    db: Database,
    workspaceId: string,
    userId: string
  ): Promise<number[]> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Query grouped by day
    const results = await db
      .select({
        date: sql<string>`DATE(${crmActivities.createdAt})`,
        count: count(),
      })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, sevenDaysAgo),
          lte(crmActivities.createdAt, today),
          isNull(crmActivities.deletedAt)
        )
      )
      .groupBy(sql`DATE(${crmActivities.createdAt})`);

    // Create map of date -> count
    const countMap = new Map<string, number>();
    for (const row of results) {
      countMap.set(row.date, row.count);
    }

    // Fill in all 7 days (even if 0 calls)
    const dailyCounts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts.push(countMap.get(dateStr) || 0);
    }

    return dailyCounts;
  },

  /**
   * Get daily conversion rates for last 7 days
   * Returns array of 7 numbers (percentages, oldest to newest)
   */
  async getDailyConversions(
    db: Database,
    workspaceId: string,
    userId: string
  ): Promise<number[]> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Query RPC calls grouped by day
    const rpcResults = await db
      .select({
        date: sql<string>`DATE(${crmActivities.createdAt})`,
        count: count(),
      })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          gte(crmActivities.createdAt, sevenDaysAgo),
          lte(crmActivities.createdAt, today),
          isNull(crmActivities.deletedAt),
          sql`${crmActivities.disposition} IN ('rpc_interested', 'rpc_not_interested')`
        )
      )
      .groupBy(sql`DATE(${crmActivities.createdAt})`);

    // Query qualified calls grouped by day
    const qualifiedResults = await db
      .select({
        date: sql<string>`DATE(${crmActivities.createdAt})`,
        count: count(),
      })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.assigneeId, userId),
          eq(crmActivities.type, 'call'),
          eq(crmActivities.status, 'completed'),
          eq(crmActivities.disposition, 'rpc_interested'),
          gte(crmActivities.createdAt, sevenDaysAgo),
          lte(crmActivities.createdAt, today),
          isNull(crmActivities.deletedAt)
        )
      )
      .groupBy(sql`DATE(${crmActivities.createdAt})`);

    // Create maps
    const rpcMap = new Map<string, number>();
    for (const row of rpcResults) {
      rpcMap.set(row.date, row.count);
    }

    const qualifiedMap = new Map<string, number>();
    for (const row of qualifiedResults) {
      qualifiedMap.set(row.date, row.count);
    }

    // Calculate conversion rates for all 7 days
    const conversionRates: number[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const rpcCount = rpcMap.get(dateStr) || 0;
      const qualifiedCount = qualifiedMap.get(dateStr) || 0;

      const conversionRate = rpcCount > 0 ? (qualifiedCount / rpcCount) * 100 : 0;
      conversionRates.push(Math.round(conversionRate * 100) / 100);
    }

    return conversionRates;
  },
};
