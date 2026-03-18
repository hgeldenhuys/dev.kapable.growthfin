/**
 * Lead Enrichment Routes (US-LEAD-AI-009)
 * API endpoints for AI-powered lead enrichment
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { leadEnrichments } from '@agios/db';
import { and, eq, desc } from 'drizzle-orm';
import { jobQueue } from '../../../lib/queue';

export const leadEnrichmentRoutes = new Elysia({ prefix: '/leads' })
  /**
   * POST /api/v1/crm/leads/:id/enrich
   * Trigger enrichment for a specific lead
   */
  .post(
    '/:id/enrich',
    async ({ params, query, body }) => {
      const { id: leadId } = params;
      const { workspaceId } = query;
      const { sources = ['company', 'contact'], force = false } = body;

      console.log(`[Lead Enrichment API] Queueing enrichment for lead ${leadId}...`);

      try {
        // Queue enrichment job
        const jobId = await jobQueue.send('enrich-lead', {
          leadId,
          workspaceId,
          sources,
          priority: 'normal',
          force,
        });

        console.log(`[Lead Enrichment API] Job queued with ID: ${jobId}`);

        return {
          enrichment_id: jobId,
          status: 'pending',
          estimated_completion: new Date(Date.now() + 30000).toISOString(), // 30 seconds
          sources_requested: sources,
        };
      } catch (error: any) {
        console.error(`[Lead Enrichment API] Failed to queue enrichment:`, error);

        return {
          error: 'QUEUE_ERROR',
          message: error.message || 'Failed to queue enrichment job',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        sources: t.Optional(t.Array(t.String())),
        fields: t.Optional(t.Array(t.String())),
        force: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Lead Enrichment'],
        summary: 'Trigger lead enrichment',
        description:
          'Queue a lead enrichment job. Enrichment happens asynchronously via background worker.',
      },
    }
  )

  /**
   * GET /api/v1/crm/leads/:id/enrichment
   * Get enrichment status and data for a lead
   */
  .get(
    '/:id/enrichment',
    async ({ params, query }) => {
      const { id: leadId } = params;
      const { workspaceId } = query;

      console.log(`[Lead Enrichment API] Fetching enrichment for lead ${leadId}...`);

      try {
        const enrichment = await db.query.leadEnrichments.findFirst({
          where: and(
            eq(leadEnrichments.leadId, leadId),
            eq(leadEnrichments.workspaceId, workspaceId)
          ),
          orderBy: [desc(leadEnrichments.createdAt)],
        });

        if (!enrichment) {
          return {
            enrichment_id: null,
            status: 'not_enriched',
            message: 'Lead has not been enriched yet',
          };
        }

        return {
          enrichment_id: enrichment.id,
          status: enrichment.status,
          enriched_at: enrichment.enrichedAt,
          enriched_fields: enrichment.enrichedFields,
          confidence_scores: enrichment.confidenceScores,
          source: enrichment.source,
          retry_count: enrichment.retryCount,
          error_message: enrichment.errorMessage,
        };
      } catch (error: any) {
        console.error(`[Lead Enrichment API] Failed to fetch enrichment:`, error);

        return {
          error: 'QUERY_ERROR',
          message: error.message || 'Failed to fetch enrichment data',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Lead Enrichment'],
        summary: 'Get lead enrichment status',
        description: 'Fetch the latest enrichment status and data for a specific lead.',
      },
    }
  )

  /**
   * POST /api/v1/crm/leads/:id/enrichment/cancel
   * BL-ENR-017: Cancel active enrichment for a lead
   */
  .post(
    '/:id/enrichment/cancel',
    async ({ params, query }) => {
      const { id: leadId } = params;
      const { workspaceId } = query;

      console.log(`[Lead Enrichment API] Cancelling enrichment for lead ${leadId}...`);

      try {
        // Find the most recent active enrichment for this lead
        const enrichment = await db.query.leadEnrichments.findFirst({
          where: and(
            eq(leadEnrichments.leadId, leadId),
            eq(leadEnrichments.workspaceId, workspaceId)
          ),
          orderBy: [desc(leadEnrichments.createdAt)],
        });

        if (!enrichment) {
          return { error: 'No enrichment found for this lead' };
        }

        if (enrichment.status !== 'in_progress' && enrichment.status !== 'pending') {
          return {
            error: 'Enrichment is not active',
            status: enrichment.status,
          };
        }

        // Mark enrichment as failed/cancelled
        await db.update(leadEnrichments)
          .set({
            status: 'failed',
            errorMessage: 'Cancelled by user',
            enrichedAt: new Date(),
          })
          .where(eq(leadEnrichments.id, enrichment.id));

        return {
          success: true,
          enrichment_id: enrichment.id,
          message: 'Enrichment cancelled',
        };
      } catch (error: any) {
        console.error(`[Lead Enrichment API] Failed to cancel enrichment:`, error);
        return {
          error: 'CANCEL_ERROR',
          message: error.message || 'Failed to cancel enrichment',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Lead Enrichment'],
        summary: 'Cancel lead enrichment',
        description: 'Cancel the active enrichment job for a specific lead.',
      },
    }
  )

  /**
   * GET /api/v1/crm/leads/:id/enrichment/history
   * Get enrichment history for a lead
   */
  .get(
    '/:id/enrichment/history',
    async ({ params, query }) => {
      const { id: leadId } = params;
      const { workspaceId } = query;

      console.log(`[Lead Enrichment API] Fetching enrichment history for lead ${leadId}...`);

      try {
        const enrichments = await db.query.leadEnrichments.findMany({
          where: and(
            eq(leadEnrichments.leadId, leadId),
            eq(leadEnrichments.workspaceId, workspaceId)
          ),
          orderBy: [desc(leadEnrichments.createdAt)],
        });

        return {
          lead_id: leadId,
          enrichment_count: enrichments.length,
          enrichments: enrichments.map((e) => ({
            enrichment_id: e.id,
            status: e.status,
            source: e.source,
            enriched_at: e.enrichedAt,
            retry_count: e.retryCount,
            error_message: e.errorMessage,
            estimated_cost: e.estimatedCost,
            actual_cost: e.actualCost,
            created_at: e.createdAt,
          })),
        };
      } catch (error: any) {
        console.error(`[Lead Enrichment API] Failed to fetch enrichment history:`, error);

        return {
          error: 'QUERY_ERROR',
          message: error.message || 'Failed to fetch enrichment history',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Lead Enrichment'],
        summary: 'Get lead enrichment history',
        description: 'Fetch all enrichment attempts for a specific lead.',
      },
    }
  )

  /**
   * POST /api/v1/crm/leads/:id/enrichment/retry (CRM-004)
   * Retry failed enrichment for a specific lead
   */
  .post(
    '/:id/enrichment/retry',
    async ({ params, query }) => {
      const { id: leadId } = params;
      const { workspaceId } = query;

      console.log(`[Lead Enrichment API] Retry enrichment for lead ${leadId}...`);

      try {
        // Get latest enrichment record
        const latestEnrichment = await db.query.leadEnrichments.findFirst({
          where: and(
            eq(leadEnrichments.leadId, leadId),
            eq(leadEnrichments.workspaceId, workspaceId)
          ),
          orderBy: [desc(leadEnrichments.createdAt)],
        });

        // Check retry count limit
        const maxRetries = 3;
        if (latestEnrichment && latestEnrichment.retryCount >= maxRetries) {
          return {
            error: 'MAX_RETRIES_EXCEEDED',
            message: `Maximum retry attempts (${maxRetries}) exceeded. Last error: ${latestEnrichment.errorMessage}`,
            retry_count: latestEnrichment.retryCount,
          };
        }

        // Queue new enrichment job with retry flag
        const jobId = await jobQueue.send('enrich-lead', {
          leadId,
          workspaceId,
          sources: ['company', 'contact'],
          priority: 'high', // Retry jobs get higher priority
          force: true, // Force re-enrichment
        });

        console.log(`[Lead Enrichment API] Retry job queued with ID: ${jobId}`);

        return {
          enrichment_id: jobId,
          status: 'pending',
          retry_count: (latestEnrichment?.retryCount || 0) + 1,
          previous_error: latestEnrichment?.errorMessage || null,
          estimated_completion: new Date(Date.now() + 30000).toISOString(),
        };
      } catch (error: any) {
        console.error(`[Lead Enrichment API] Failed to queue retry:`, error);

        return {
          error: 'RETRY_ERROR',
          message: error.message || 'Failed to queue retry job',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Lead Enrichment'],
        summary: 'Retry failed enrichment',
        description: 'Queue a retry for a failed lead enrichment. Maximum 3 retries allowed.',
      },
    }
  );
