/**
 * Job Report Routes (US-011)
 * Comprehensive execution report for completed jobs
 *
 * Endpoints:
 * - GET /jobs/:jobId/report - Get full execution report with entities and tool calls
 *
 * Architecture:
 * - Aggregates data from job_logs, crm_enrichment_results, and crm_tool_calls
 * - Returns comprehensive report for task execution transparency
 * - Used by frontend to display detailed execution results
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { and, eq, desc, inArray } from 'drizzle-orm';
import {
  jobLogs,
  crmEnrichmentResults,
  crmToolCalls,
  crmEnrichmentJobs,
  crmContacts,
  crmLeads,
} from '@agios/db/schema';

export const jobReportRoutes = new Elysia({ prefix: '/jobs' })
  /**
   * GET /:jobId/report - Get comprehensive job execution report
   *
   * Returns complete execution details including:
   * - Job metadata (status, duration, timestamps)
   * - Aggregated summary (counts, costs, durations)
   * - All job logs
   * - Entity-level results with tool calls
   */
  .get(
    '/:jobId/report',
    async ({ params, query }) => {
      const { jobId } = params;
      const { workspaceId } = query;

      // 1. Get job metadata
      const [job] = await db
        .select({
          id: crmEnrichmentJobs.id,
          jobType: crmEnrichmentJobs.type,
          status: crmEnrichmentJobs.status,
          startedAt: crmEnrichmentJobs.startedAt,
          completedAt: crmEnrichmentJobs.completedAt,
          totalContacts: crmEnrichmentJobs.totalContacts,
          processedContacts: crmEnrichmentJobs.processedContacts,
          failedContacts: crmEnrichmentJobs.failedContacts,
          skippedContacts: crmEnrichmentJobs.skippedContacts,
          actualCost: crmEnrichmentJobs.actualCost,
        })
        .from(crmEnrichmentJobs)
        .where(
          and(
            eq(crmEnrichmentJobs.id, jobId),
            eq(crmEnrichmentJobs.workspaceId, workspaceId)
          )
        );

      if (!job) {
        throw new Error(`Job ${jobId} not found in workspace ${workspaceId}`);
      }

      // Calculate duration
      const durationMs = job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : null;

      // 2. Get all job logs
      const logs = await db
        .select()
        .from(jobLogs)
        .where(
          and(
            eq(jobLogs.jobId, jobId),
            eq(jobLogs.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(jobLogs.createdAt));

      // 3. Get enrichment results
      const results = await db
        .select()
        .from(crmEnrichmentResults)
        .where(
          and(
            eq(crmEnrichmentResults.jobId, jobId),
            eq(crmEnrichmentResults.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(crmEnrichmentResults.createdAt));

      // 3a. Get entity names separately (to avoid left join issues)
      const contactIds = results
        .filter((r) => r.entityType === 'contact')
        .map((r) => r.entityId);
      const leadIds = results
        .filter((r) => r.entityType === 'lead')
        .map((r) => r.entityId);

      const contactsMap: Record<string, { name: string; email: string | null }> = {};
      const leadsMap: Record<string, { name: string; email: string | null }> = {};

      if (contactIds.length > 0) {
        const contacts = await db
          .select()
          .from(crmContacts)
          .where(inArray(crmContacts.id, contactIds));

        for (const contact of contacts) {
          contactsMap[contact.id] = { name: contact.name, email: contact.email };
        }
      }

      if (leadIds.length > 0) {
        const leads = await db
          .select()
          .from(crmLeads)
          .where(inArray(crmLeads.id, leadIds));

        for (const lead of leads) {
          // Leads have firstName and lastName, not name
          const fullName = `${lead.firstName} ${lead.lastName}`.trim();
          leadsMap[lead.id] = { name: fullName, email: lead.email };
        }
      }

      // 4. Get tool calls for each enrichment result
      const resultIds = results.map((r) => r.id);

      let toolCallsByResult: Record<string, any[]> = {};

      if (resultIds.length > 0) {
        const toolCalls = await db
          .select()
          .from(crmToolCalls)
          .where(
            and(
              inArray(crmToolCalls.enrichmentResultId, resultIds),
              eq(crmToolCalls.workspaceId, workspaceId)
            )
          )
          .orderBy(desc(crmToolCalls.createdAt));

        // Group tool calls by enrichment result ID
        for (const toolCall of toolCalls) {
          const resultId = toolCall.enrichmentResultId;
          if (!toolCallsByResult[resultId]) {
            toolCallsByResult[resultId] = [];
          }
          toolCallsByResult[resultId].push({
            id: toolCall.id,
            toolName: toolCall.toolName,
            arguments: toolCall.arguments,
            result: toolCall.result,
            status: toolCall.status,
            cost: toolCall.cost,
            durationMs: toolCall.durationMs,
            provider: toolCall.provider,
            error: toolCall.error,
            createdAt: toolCall.createdAt,
          });
        }
      }

      // 5. Build entity results with tool calls
      const entities = results.map((result) => {
        const entity = result.entityType === 'contact'
          ? contactsMap[result.entityId]
          : leadsMap[result.entityId];

        return {
          id: result.entityId,
          name: entity?.name || 'Unknown',
          email: entity?.email || null,
          entityType: result.entityType,
          status: result.status,
          score: result.score,
          cost: result.cost,
          durationMs: result.durationMs,
          tokensUsed: result.tokensUsed,
          enrichmentData: result.enrichmentData,
          reasoning: result.reasoning,
          errorMessage: result.errorMessage,
          toolCalls: toolCallsByResult[result.id] || [],
          processedAt: result.createdAt,
        };
      });

      // 6. Calculate summary statistics
      const summary = {
        totalEntities: job.totalContacts,
        successful: job.processedContacts,
        failed: job.failedContacts,
        skipped: job.skippedContacts,
        totalCost: parseFloat(job.actualCost || '0'),
        totalDurationMs: durationMs,
        // Calculate from actual results (more accurate than job-level counts)
        avgCostPerEntity: entities.length > 0
          ? entities.reduce((sum, e) => sum + parseFloat(e.cost || '0'), 0) / entities.length
          : 0,
        avgDurationPerEntity: entities.length > 0
          ? entities.reduce((sum, e) => sum + (e.durationMs || 0), 0) / entities.length
          : 0,
        totalToolCalls: Object.values(toolCallsByResult).reduce((sum, calls) => sum + calls.length, 0),
      };

      // 7. Return comprehensive report
      return {
        job: {
          id: job.id,
          jobType: job.jobType,
          status: job.status,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          durationMs,
        },
        summary,
        logs,
        entities,
      };
    },
    {
      params: t.Object({
        jobId: t.String({ description: 'Job ID (UUID)', format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({
          description: 'Workspace ID for authorization',
          format: 'uuid',
        }),
      }),
      detail: {
        tags: ['Job Observability'],
        summary: 'Get comprehensive job execution report',
        description:
          'Returns full execution report including job metadata, summary statistics, all logs, and entity-level results with tool calls. Used for task execution transparency (US-011).',
      },
    }
  );
