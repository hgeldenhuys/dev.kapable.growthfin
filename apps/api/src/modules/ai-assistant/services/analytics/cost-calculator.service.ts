/**
 * Cost Calculator Service
 * Calculates token costs based on OpenRouter pricing
 */

import { db, aiMessages, aiConversations } from '@agios/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

// OpenRouter pricing (per 1M tokens)
export const MODEL_PRICING = {
  'anthropic/claude-3.5-haiku': {
    input: 0.25,
    output: 1.25,
  },
  'anthropic/claude-3.5-sonnet': {
    input: 3.0,
    output: 15.0,
  },
  // Add more models as needed
} as const;

export interface CostBreakdown {
  date: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  model: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class CostCalculatorService {
  /**
   * Calculate costs for a workspace within a date range
   */
  static async calculateCosts(
    workspaceId: string,
    dateRange?: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<CostBreakdown[]> {
    const conditions = [eq(aiConversations.workspaceId, workspaceId)];

    if (dateRange) {
      conditions.push(gte(aiMessages.createdAt, dateRange.startDate));
      conditions.push(lte(aiMessages.createdAt, dateRange.endDate));
    }

    // Determine date grouping based on groupBy parameter
    let dateGrouping: any;
    switch (groupBy) {
      case 'week':
        dateGrouping = sql`DATE_TRUNC('week', ${aiMessages.createdAt})`;
        break;
      case 'month':
        dateGrouping = sql`DATE_TRUNC('month', ${aiMessages.createdAt})`;
        break;
      default:
        dateGrouping = sql`DATE(${aiMessages.createdAt})`;
    }

    const results = await db
      .select({
        date: sql<string>`${dateGrouping}::text`,
        model: aiMessages.model,
        inputTokens: sql<number>`COALESCE(SUM((${aiMessages.tokenUsage}->>'input')::int), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM((${aiMessages.tokenUsage}->>'output')::int), 0)::int`,
      })
      .from(aiMessages)
      .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
      .where(and(...conditions))
      .groupBy(dateGrouping, aiMessages.model)
      .orderBy(sql`${dateGrouping} DESC`);

    // Calculate costs for each row
    return results.map((row) => {
      const costs = this.calculateTokenCost(
        row.inputTokens,
        row.outputTokens,
        row.model || 'anthropic/claude-3.5-haiku'
      );

      return {
        date: row.date,
        totalCost: costs.totalCost,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        inputCost: costs.inputCost,
        outputCost: costs.outputCost,
        model: row.model || 'anthropic/claude-3.5-haiku',
      };
    });
  }

  /**
   * Get total cost summary
   */
  static async getTotalCost(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<{ totalCost: number; totalInputTokens: number; totalOutputTokens: number }> {
    const conditions = [eq(aiConversations.workspaceId, workspaceId)];

    if (dateRange) {
      conditions.push(gte(aiMessages.createdAt, dateRange.startDate));
      conditions.push(lte(aiMessages.createdAt, dateRange.endDate));
    }

    const results = await db
      .select({
        model: aiMessages.model,
        inputTokens: sql<number>`COALESCE(SUM((${aiMessages.tokenUsage}->>'input')::int), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM((${aiMessages.tokenUsage}->>'output')::int), 0)::int`,
      })
      .from(aiMessages)
      .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
      .where(and(...conditions))
      .groupBy(aiMessages.model);

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const row of results) {
      const costs = this.calculateTokenCost(
        row.inputTokens,
        row.outputTokens,
        row.model || 'anthropic/claude-3.5-haiku'
      );
      totalCost += costs.totalCost;
      totalInputTokens += row.inputTokens;
      totalOutputTokens += row.outputTokens;
    }

    return {
      totalCost,
      totalInputTokens,
      totalOutputTokens,
    };
  }

  /**
   * Calculate cost from token usage
   */
  static calculateTokenCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): { inputCost: number; outputCost: number; totalCost: number } {
    const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
    if (!pricing) {
      // Default to Haiku pricing if model not found
      const defaultPricing = MODEL_PRICING['anthropic/claude-3.5-haiku'];
      const inputCost = (inputTokens / 1_000_000) * defaultPricing.input;
      const outputCost = (outputTokens / 1_000_000) * defaultPricing.output;
      return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      };
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  }
}
