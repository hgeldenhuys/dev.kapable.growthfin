/**
 * AI Call Analytics Routes
 * Phase K: AI Call Analytics Dashboard
 *
 * Provides endpoints for AI call performance metrics, trends, and script analysis.
 */

import { Elysia, t } from 'elysia';
import { eq, and, gte, lte, sql, count, sum, avg, desc } from 'drizzle-orm';
import { crmAiCalls, crmAiCallScripts } from '@agios/db/schema';

// Date range helper - calculate date from period string
function getDateFromPeriod(period: string): Date {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7));
    case '30d':
      return new Date(now.setDate(now.getDate() - 30));
    case '90d':
      return new Date(now.setDate(now.getDate() - 90));
    case 'all':
    default:
      return new Date(0); // Beginning of time
  }
}

// Format duration as mm:ss
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const aiCallAnalyticsRoutes = new Elysia({ prefix: '/analytics/ai-calls' })
  /**
   * GET / - Overview metrics (calls, success rate, duration, cost)
   */
  .get(
    '/',
    async ({ db, query }) => {
      const startDate = query.period ? getDateFromPeriod(query.period) : getDateFromPeriod('30d');

      // Get all AI calls in period
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            gte(crmAiCalls.createdAt, startDate)
          )
        );

      // Calculate metrics
      const totalCalls = aiCalls.length;
      const completedCalls = aiCalls.filter(c => c.callOutcome !== 'failed' && c.callOutcome !== null);
      const interestedCalls = aiCalls.filter(c => c.callOutcome === 'interested');
      const callbackCalls = aiCalls.filter(c => c.callOutcome === 'callback');
      const failedCalls = aiCalls.filter(c => c.callOutcome === 'failed');

      const successRate = totalCalls > 0
        ? Math.round((interestedCalls.length + callbackCalls.length) / totalCalls * 100)
        : 0;

      const totalDuration = aiCalls.reduce((sum, c) => sum + (c.audioSeconds || 0), 0);
      const avgDuration = completedCalls.length > 0
        ? Math.round(totalDuration / completedCalls.length)
        : 0;

      const totalCost = aiCalls.reduce((sum, c) => sum + parseFloat(c.cost || '0'), 0);

      // Sentiment breakdown
      const positiveSentiment = aiCalls.filter(c => c.sentiment === 'positive').length;
      const neutralSentiment = aiCalls.filter(c => c.sentiment === 'neutral').length;
      const negativeSentiment = aiCalls.filter(c => c.sentiment === 'negative').length;

      // Lead quality breakdown
      const hotLeads = aiCalls.filter(c => c.analysis?.leadQuality === 'hot').length;
      const warmLeads = aiCalls.filter(c => c.analysis?.leadQuality === 'warm').length;
      const coldLeads = aiCalls.filter(c => c.analysis?.leadQuality === 'cold').length;

      // Direction breakdown (Phase L: Inbound AI Calls)
      const inboundCalls = aiCalls.filter(c => c.direction === 'inbound');
      const outboundCalls = aiCalls.filter(c => c.direction === 'outbound' || !c.direction);
      const identificationRate = inboundCalls.length > 0
        ? Math.round(inboundCalls.filter(c => c.callerIdentified).length / inboundCalls.length * 100)
        : 0;

      return {
        period: query.period || '30d',
        metrics: {
          totalCalls,
          successRate,
          avgDuration,
          avgDurationFormatted: formatDuration(avgDuration),
          totalDuration,
          totalDurationFormatted: formatDuration(totalDuration),
          totalCost: totalCost.toFixed(2),
        },
        outcomes: {
          interested: interestedCalls.length,
          notInterested: aiCalls.filter(c => c.callOutcome === 'not_interested').length,
          callback: callbackCalls.length,
          voicemail: aiCalls.filter(c => c.callOutcome === 'voicemail').length,
          noAnswer: aiCalls.filter(c => c.callOutcome === 'no_answer').length,
          failed: failedCalls.length,
        },
        sentiment: {
          positive: positiveSentiment,
          neutral: neutralSentiment,
          negative: negativeSentiment,
        },
        leadQuality: {
          hot: hotLeads,
          warm: warmLeads,
          cold: coldLeads,
        },
        direction: {
          inbound: inboundCalls.length,
          outbound: outboundCalls.length,
          identificationRate,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        period: t.Optional(t.String()), // '7d', '30d', '90d', 'all'
      }),
      detail: {
        tags: ['AI Call Analytics'],
        summary: 'Get AI call overview metrics',
        description: 'Returns aggregated metrics for AI calls including success rate, duration, and cost',
      },
    }
  )

  /**
   * GET /trends - Time series data (daily/weekly volume)
   */
  .get(
    '/trends',
    async ({ db, query }) => {
      const startDate = query.period ? getDateFromPeriod(query.period) : getDateFromPeriod('30d');

      // Get all AI calls in period
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            gte(crmAiCalls.createdAt, startDate)
          )
        )
        .orderBy(crmAiCalls.createdAt);

      // Group by date
      const dailyData: Record<string, {
        date: string;
        total: number;
        interested: number;
        callback: number;
        failed: number;
        duration: number;
        cost: number;
      }> = {};

      for (const call of aiCalls) {
        const dateKey = call.createdAt.toISOString().split('T')[0];

        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            total: 0,
            interested: 0,
            callback: 0,
            failed: 0,
            duration: 0,
            cost: 0,
          };
        }

        dailyData[dateKey].total++;
        if (call.callOutcome === 'interested') dailyData[dateKey].interested++;
        if (call.callOutcome === 'callback') dailyData[dateKey].callback++;
        if (call.callOutcome === 'failed') dailyData[dateKey].failed++;
        dailyData[dateKey].duration += call.audioSeconds || 0;
        dailyData[dateKey].cost += parseFloat(call.cost || '0');
      }

      // Convert to array and sort by date
      const trends = Object.values(dailyData).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      return { trends };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        period: t.Optional(t.String()), // '7d', '30d', '90d', 'all'
      }),
      detail: {
        tags: ['AI Call Analytics'],
        summary: 'Get AI call trends',
        description: 'Returns daily time series data for AI call volume and outcomes',
      },
    }
  )

  /**
   * GET /scripts - Script performance ranking
   */
  .get(
    '/scripts',
    async ({ db, query }) => {
      const startDate = query.period ? getDateFromPeriod(query.period) : getDateFromPeriod('30d');

      // Get all scripts for workspace
      const scripts = await db
        .select()
        .from(crmAiCallScripts)
        .where(eq(crmAiCallScripts.workspaceId, query.workspaceId));

      // Get all AI calls in period
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            gte(crmAiCalls.createdAt, startDate)
          )
        );

      // For now, we track script performance via useCount on the script
      // In future, we could link aiCalls to scriptId directly
      const scriptPerformance = scripts.map(script => {
        // Calculate success rate from the stored value or estimate
        const successRate = script.successRate ? parseFloat(script.successRate as string) : 0;

        return {
          id: script.id,
          name: script.name,
          purpose: script.purpose,
          calls: script.useCount || 0,
          successRate: successRate.toFixed(1),
          isDefault: script.isDefault,
          isActive: script.isActive,
        };
      });

      // Sort by calls (most used first)
      scriptPerformance.sort((a, b) => (b.calls || 0) - (a.calls || 0));

      return { scripts: scriptPerformance };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        period: t.Optional(t.String()), // '7d', '30d', '90d', 'all'
      }),
      detail: {
        tags: ['AI Call Analytics'],
        summary: 'Get script performance',
        description: 'Returns performance metrics for each AI call script',
      },
    }
  )

  /**
   * GET /outcomes - Outcome distribution
   */
  .get(
    '/outcomes',
    async ({ db, query }) => {
      const startDate = query.period ? getDateFromPeriod(query.period) : getDateFromPeriod('30d');

      // Get all AI calls in period
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            gte(crmAiCalls.createdAt, startDate)
          )
        );

      const total = aiCalls.length;

      // Count outcomes
      const outcomeCounts = {
        interested: aiCalls.filter(c => c.callOutcome === 'interested').length,
        not_interested: aiCalls.filter(c => c.callOutcome === 'not_interested').length,
        callback: aiCalls.filter(c => c.callOutcome === 'callback').length,
        voicemail: aiCalls.filter(c => c.callOutcome === 'voicemail').length,
        no_answer: aiCalls.filter(c => c.callOutcome === 'no_answer').length,
        failed: aiCalls.filter(c => c.callOutcome === 'failed').length,
        pending: aiCalls.filter(c => c.callOutcome === null).length,
      };

      // Convert to distribution with percentages
      const distribution = Object.entries(outcomeCounts).map(([outcome, count]) => ({
        outcome,
        count,
        percentage: total > 0 ? Math.round(count / total * 100) : 0,
      }));

      return {
        total,
        distribution,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        period: t.Optional(t.String()), // '7d', '30d', '90d', 'all'
      }),
      detail: {
        tags: ['AI Call Analytics'],
        summary: 'Get outcome distribution',
        description: 'Returns distribution of call outcomes with percentages',
      },
    }
  )

  /**
   * GET /duration - Duration distribution
   */
  .get(
    '/duration',
    async ({ db, query }) => {
      const startDate = query.period ? getDateFromPeriod(query.period) : getDateFromPeriod('30d');

      // Get all AI calls in period with duration
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            gte(crmAiCalls.createdAt, startDate)
          )
        );

      const callsWithDuration = aiCalls.filter(c => c.audioSeconds !== null && c.audioSeconds > 0);

      // Duration buckets
      const buckets = {
        'under_1m': callsWithDuration.filter(c => (c.audioSeconds || 0) < 60).length,
        '1_2m': callsWithDuration.filter(c => (c.audioSeconds || 0) >= 60 && (c.audioSeconds || 0) < 120).length,
        '2_3m': callsWithDuration.filter(c => (c.audioSeconds || 0) >= 120 && (c.audioSeconds || 0) < 180).length,
        '3_5m': callsWithDuration.filter(c => (c.audioSeconds || 0) >= 180 && (c.audioSeconds || 0) < 300).length,
        '5_10m': callsWithDuration.filter(c => (c.audioSeconds || 0) >= 300 && (c.audioSeconds || 0) < 600).length,
        'over_10m': callsWithDuration.filter(c => (c.audioSeconds || 0) >= 600).length,
      };

      const total = callsWithDuration.length;

      const distribution = Object.entries(buckets).map(([bucket, count]) => ({
        bucket,
        label: bucket.replace(/_/g, ' ').replace('m', ' min'),
        count,
        percentage: total > 0 ? Math.round(count / total * 100) : 0,
      }));

      // Calculate stats
      const durations = callsWithDuration.map(c => c.audioSeconds || 0);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
      const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

      return {
        total,
        distribution,
        stats: {
          avg: avgDuration,
          avgFormatted: formatDuration(avgDuration),
          max: maxDuration,
          maxFormatted: formatDuration(maxDuration),
          min: minDuration,
          minFormatted: formatDuration(minDuration),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        period: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Call Analytics'],
        summary: 'Get duration distribution',
        description: 'Returns distribution of call durations in buckets',
      },
    }
  );
