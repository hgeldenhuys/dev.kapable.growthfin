/**
 * Enrichment Analytics Routes
 * API endpoints for tool usage tracking and analytics
 */

import { Elysia } from 'elysia';
import { db } from '@agios/db';
import { crmToolCalls, crmEnrichmentJobs, crmEnrichmentResults } from '@agios/db/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';

export const enrichmentAnalyticsRoutes = new Elysia({ prefix: '/enrichment/analytics' })
  /**
   * Get tool usage statistics for a workspace
   * GET /crm/enrichment/analytics/tool-usage
   */
  .get('/tool-usage', async ({ query }) => {
    const { workspaceId, jobId, days } = query as {
      workspaceId: string;
      jobId?: string;
      days?: string;
    };

    if (!workspaceId) {
      return {
        error: 'workspaceId is required',
        status: 400,
      };
    }

    // Build where clause
    const conditions = [eq(crmToolCalls.workspaceId, workspaceId)];

    if (jobId) {
      // Join to get job filter
      const jobResults = await db
        .select({ id: crmEnrichmentResults.id })
        .from(crmEnrichmentResults)
        .where(eq(crmEnrichmentResults.jobId, jobId));

      const resultIds = jobResults.map(r => r.id);
      if (resultIds.length > 0) {
        conditions.push(sql`${crmToolCalls.enrichmentResultId} = ANY(${resultIds})`);
      }
    }

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
      conditions.push(gte(crmToolCalls.createdAt, cutoffDate));
    }

    // Get tool usage statistics
    const toolStats = await db
      .select({
        toolName: crmToolCalls.toolName,
        callCount: sql<number>`count(*)::int`,
        totalCost: sql<number>`sum(${crmToolCalls.cost})::numeric`,
        avgDuration: sql<number>`avg(${crmToolCalls.durationMs})::int`,
        successCount: sql<number>`count(*) filter (where ${crmToolCalls.status} = 'success')::int`,
        failureCount: sql<number>`count(*) filter (where ${crmToolCalls.status} = 'failed')::int`,
      })
      .from(crmToolCalls)
      .where(and(...conditions))
      .groupBy(crmToolCalls.toolName)
      .orderBy(desc(sql`count(*)`));

    return {
      tools: toolStats.map(stat => ({
        name: stat.toolName,
        calls: stat.callCount,
        totalCost: parseFloat(stat.totalCost?.toString() || '0'),
        avgDurationMs: stat.avgDuration || 0,
        successRate: stat.callCount > 0
          ? ((stat.successCount / stat.callCount) * 100).toFixed(1)
          : '0',
        failures: stat.failureCount,
      })),
      meta: {
        workspaceId,
        jobId,
        days: days ? parseInt(days) : null,
      },
    };
  })

  /**
   * Get enrichment job cost breakdown
   * GET /crm/enrichment/analytics/job-costs
   */
  .get('/job-costs', async ({ query }) => {
    const { workspaceId, days } = query as {
      workspaceId: string;
      days?: string;
    };

    if (!workspaceId) {
      return {
        error: 'workspaceId is required',
        status: 400,
      };
    }

    // Build where clause
    const conditions = [eq(crmEnrichmentJobs.workspaceId, workspaceId)];

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
      conditions.push(gte(crmEnrichmentJobs.createdAt, cutoffDate));
    }

    // Get job costs
    const jobs = await db
      .select({
        id: crmEnrichmentJobs.id,
        name: crmEnrichmentJobs.name,
        status: crmEnrichmentJobs.status,
        actualCost: crmEnrichmentJobs.actualCost,
        budgetLimit: crmEnrichmentJobs.budgetLimit,
        totalContacts: crmEnrichmentJobs.totalContacts,
        processedContacts: crmEnrichmentJobs.processedContacts,
        createdAt: crmEnrichmentJobs.createdAt,
      })
      .from(crmEnrichmentJobs)
      .where(and(...conditions))
      .orderBy(desc(crmEnrichmentJobs.createdAt))
      .limit(100);

    const totalCost = jobs.reduce(
      (sum, job) => sum + parseFloat(job.actualCost?.toString() || '0'),
      0
    );

    const totalBudget = jobs.reduce(
      (sum, job) => sum + parseFloat(job.budgetLimit?.toString() || '0'),
      0
    );

    return {
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        actualCost: parseFloat(job.actualCost?.toString() || '0'),
        budgetLimit: parseFloat(job.budgetLimit?.toString() || '0'),
        budgetUtilization: job.budgetLimit
          ? ((parseFloat(job.actualCost?.toString() || '0') / parseFloat(job.budgetLimit.toString())) * 100).toFixed(1)
          : '0',
        contactsProcessed: job.processedContacts,
        totalContacts: job.totalContacts,
        costPerContact: job.processedContacts > 0
          ? (parseFloat(job.actualCost?.toString() || '0') / job.processedContacts).toFixed(4)
          : '0',
        createdAt: job.createdAt,
      })),
      summary: {
        totalJobs: jobs.length,
        totalCost: totalCost.toFixed(4),
        totalBudget: totalBudget.toFixed(4),
        budgetUtilization: totalBudget > 0
          ? ((totalCost / totalBudget) * 100).toFixed(1)
          : '0',
      },
      meta: {
        workspaceId,
        days: days ? parseInt(days) : null,
      },
    };
  })

  /**
   * Get rate limiter status for all tools
   * GET /crm/enrichment/analytics/rate-limits
   */
  .get('/rate-limits', async () => {
    const {
      webSearchRateLimiter,
      emailVerificationRateLimiter,
      googleMapsRateLimiter,
      linkedInRateLimiter,
      cipcRateLimiter,
    } = await import('../../../lib/rate-limiter');

    const tools = [
      { name: 'web_search', limiter: webSearchRateLimiter },
      { name: 'verify_email', limiter: emailVerificationRateLimiter },
      { name: 'lookup_business', limiter: googleMapsRateLimiter },
      { name: 'enrich_linkedin', limiter: linkedInRateLimiter },
      { name: 'lookup_sa_company', limiter: cipcRateLimiter },
    ];

    const status = tools.map(({ name, limiter }) => {
      const usage = limiter.getUsage(name);
      const resetMs = limiter.getResetTime(name);

      return {
        tool: name,
        currentUsage: usage?.count || 0,
        limit: usage?.limit || 0,
        remaining: usage ? usage.limit - usage.count : 0,
        resetInSeconds: resetMs ? Math.ceil(resetMs / 1000) : null,
        utilizationPercent: usage && usage.limit > 0
          ? ((usage.count / usage.limit) * 100).toFixed(1)
          : '0',
      };
    });

    return {
      tools: status,
      timestamp: new Date().toISOString(),
    };
  })

  /**
   * Get detailed tool call history
   * GET /crm/enrichment/analytics/tool-history
   */
  .get('/tool-history', async ({ query }) => {
    const { workspaceId, toolName, limit = '50' } = query as {
      workspaceId: string;
      toolName?: string;
      limit?: string;
    };

    if (!workspaceId) {
      return {
        error: 'workspaceId is required',
        status: 400,
      };
    }

    const conditions = [eq(crmToolCalls.workspaceId, workspaceId)];
    if (toolName) {
      conditions.push(eq(crmToolCalls.toolName, toolName));
    }

    const history = await db
      .select({
        id: crmToolCalls.id,
        toolName: crmToolCalls.toolName,
        arguments: crmToolCalls.arguments,
        status: crmToolCalls.status,
        cost: crmToolCalls.cost,
        durationMs: crmToolCalls.durationMs,
        error: crmToolCalls.error,
        createdAt: crmToolCalls.createdAt,
      })
      .from(crmToolCalls)
      .where(and(...conditions))
      .orderBy(desc(crmToolCalls.createdAt))
      .limit(parseInt(limit));

    return {
      calls: history.map(call => ({
        id: call.id,
        tool: call.toolName,
        args: call.arguments,
        status: call.status,
        cost: parseFloat(call.cost?.toString() || '0'),
        durationMs: call.durationMs,
        error: call.error,
        timestamp: call.createdAt,
      })),
      meta: {
        workspaceId,
        toolName,
        count: history.length,
      },
    };
  });
