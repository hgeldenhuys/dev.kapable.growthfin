/**
 * Enrichment Routes
 * API endpoints for AI-powered contact enrichment
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { enrichmentService } from '../services/enrichment';
import { streamEnrichmentJobs, streamEnrichmentResults } from '../../../lib/electric-shapes';

export const enrichmentRoutes = new Elysia({ prefix: '/enrichment' })
  // ========================================================================
  // JOBS ENDPOINTS
  // ========================================================================

  /**
   * GET /enrichment/jobs - List enrichment jobs
   */
  .get(
    '/jobs',
    async ({ query }) => {
      const jobs = await enrichmentService.listJobs(
        db,
        query.workspaceId,
        query.limit ? parseInt(query.limit, 10) : 50,
        query.offset ? parseInt(query.offset, 10) : 0
      );

      return {
        jobs,
        count: jobs.length,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'List enrichment jobs',
        description: 'Get all enrichment jobs for a workspace',
      },
    }
  )

  /**
   * POST /enrichment/jobs - Create enrichment job
   */
  .post(
    '/jobs',
    async ({ body }) => {
      const job = await enrichmentService.createJob(db, {
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        type: body.type || 'scoring',
        mode: 'sample',
        sampleSize: body.sampleSize || 1,
        sourceListId: body.sourceListId,
        model: body.model || 'openai/gpt-4o-mini',
        prompt: body.prompt,
        temperature: body.temperature !== undefined ? String(body.temperature) : '0.7',
        maxTokens: body.maxTokens || 500,
        budgetLimit: body.budgetLimit !== undefined ? String(body.budgetLimit) : null,
        ownerId: body.ownerId,
        createdBy: body.createdBy,
      });

      // Calculate estimated cost
      const contactCount = body.sampleSize || 1;
      const estimatedCost = enrichmentService.estimateCost(
        contactCount,
        body.model || 'openai/gpt-4o-mini'
      );

      // Update job with estimate
      await enrichmentService.updateJob(db, job.id, body.workspaceId, {
        estimatedCost: String(estimatedCost),
      });

      return {
        ...job,
        estimatedCost: String(estimatedCost),
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal('scoring'),
            t.Literal('classification'),
            t.Literal('enhancement'),
            t.Literal('qualification'),
          ])
        ),
        sampleSize: t.Optional(t.Number()),
        sourceListId: t.String(),
        model: t.Optional(t.String()),
        prompt: t.String(),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        budgetLimit: t.Optional(t.Number()),
        ownerId: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Create enrichment job',
        description: 'Create a new AI enrichment job in draft mode',
      },
    }
  )

  /**
   * GET /enrichment/jobs/:id - Get job details
   */
  .get(
    '/jobs/:id',
    async ({ params, query }) => {
      const job = await enrichmentService.getJobWithResults(
        db,
        params.id,
        query.workspaceId
      );

      if (!job) {
        return {
          error: 'Job not found',
        };
      }

      return job;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Get job details',
        description: 'Get enrichment job with results',
      },
    }
  )

  /**
   * POST /enrichment/jobs/:id/sample - Run sample mode
   */
  .post(
    '/jobs/:id/sample',
    async ({ params, query }) => {
      const result = await enrichmentService.runSample(
        db,
        params.id,
        query.workspaceId
      );

      return {
        success: true,
        ...result,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Run sample mode',
        description: 'Test enrichment on N contacts',
      },
    }
  )

  /**
   * POST /enrichment/jobs/:id/batch - Run batch mode
   */
  .post(
    '/jobs/:id/batch',
    async ({ params, query }) => {
      const result = await enrichmentService.runBatch(
        db,
        params.id,
        query.workspaceId
      );

      return {
        success: true,
        ...result,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Run batch mode',
        description: 'Run enrichment on all contacts in list',
      },
    }
  )

  /**
   * DELETE /enrichment/jobs/:id - Cancel job
   */
  .delete(
    '/jobs/:id',
    async ({ params, query }) => {
      const job = await enrichmentService.cancelJob(
        db,
        params.id,
        query.workspaceId
      );

      if (!job) {
        return {
          error: 'Job not found',
        };
      }

      return {
        success: true,
        job,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Cancel job',
        description: 'Cancel a running enrichment job',
      },
    }
  )

  // ========================================================================
  // SCHEDULING ENDPOINTS
  // ========================================================================

  /**
   * POST /enrichment/jobs/:id/schedule - Schedule recurring job
   */
  .post(
    '/jobs/:id/schedule',
    async ({ params, body }) => {
      const job = await enrichmentService.scheduleJob(
        db,
        params.id,
        body.workspaceId,
        {
          cron: body.cron,
          timezone: body.timezone,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          maxRuns: body.maxRuns,
        }
      );

      return {
        success: true,
        job,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        cron: t.String(), // e.g., '0 9 * * 1' for 9am every Monday
        timezone: t.Optional(t.String()),
        endDate: t.Optional(t.String()), // ISO date string
        maxRuns: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Schedule recurring job',
        description: 'Schedule an enrichment job to run on a recurring schedule',
      },
    }
  )

  /**
   * POST /enrichment/jobs/:id/schedule/pause - Pause schedule
   */
  .post(
    '/jobs/:id/schedule/pause',
    async ({ params, query }) => {
      const job = await enrichmentService.pauseSchedule(
        db,
        params.id,
        query.workspaceId
      );

      if (!job) {
        return {
          error: 'Job not found or not scheduled',
        };
      }

      return {
        success: true,
        job,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Pause scheduled job',
        description: 'Temporarily pause a scheduled enrichment job',
      },
    }
  )

  /**
   * POST /enrichment/jobs/:id/schedule/resume - Resume schedule
   */
  .post(
    '/jobs/:id/schedule/resume',
    async ({ params, query }) => {
      const job = await enrichmentService.resumeSchedule(
        db,
        params.id,
        query.workspaceId
      );

      if (!job) {
        return {
          error: 'Job not found or not scheduled',
        };
      }

      return {
        success: true,
        job,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Resume paused schedule',
        description: 'Resume a paused scheduled enrichment job',
      },
    }
  )

  /**
   * DELETE /enrichment/jobs/:id/schedule - Unschedule job
   */
  .delete(
    '/jobs/:id/schedule',
    async ({ params, query }) => {
      const job = await enrichmentService.unscheduleJob(
        db,
        params.id,
        query.workspaceId
      );

      if (!job) {
        return {
          error: 'Job not found',
        };
      }

      return {
        success: true,
        job,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Unschedule job',
        description: 'Remove recurring schedule from an enrichment job',
      },
    }
  )

  // ========================================================================
  // STREAMING ENDPOINTS (SSE)
  // ========================================================================

  /**
   * GET /enrichment/jobs/stream - Stream job updates
   */
  .get(
    '/jobs/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(
        `[enrichment/jobs/stream] Starting stream for workspace ${query.workspaceId}`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamEnrichmentJobs(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[enrichment/jobs/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Stream job updates',
        description: 'Stream real-time job updates via ElectricSQL (SSE)',
      },
    }
  )

  /**
   * GET /enrichment/results/:id - Get enrichment result with tool calls
   */
  .get(
    '/results/:id',
    async ({ params, query }) => {
      const result = await enrichmentService.getResultWithToolCalls(
        db,
        params.id,
        query.workspaceId
      );

      if (!result) {
        return {
          error: 'Result not found',
        };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Get enrichment result details',
        description: 'Get enrichment result with all tool calls',
      },
    }
  )

  /**
   * GET /enrichment/jobs/:id/results/stream - Stream result updates
   */
  .get(
    '/jobs/:id/results/stream',
    async function* ({ params, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[enrichment/results/stream] Starting stream for job ${params.id}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamEnrichmentResults(params.id, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[enrichment/results/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Stream result updates',
        description: 'Stream real-time enrichment results via ElectricSQL (SSE)',
      },
    }
  )

  // ========================================================================
  // SCORING MODELS ENDPOINTS
  // ========================================================================

  /**
   * GET /enrichment/scoring-models - List scoring models
   */
  .get(
    '/scoring-models',
    async ({ query }) => {
      const models = await enrichmentService.listScoringModels(
        db,
        query.workspaceId,
        query.isTemplate === 'true'
      );

      return {
        models,
        count: models.length,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        isTemplate: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'List scoring models',
        description: 'Get all scoring model templates and custom models',
      },
    }
  )

  /**
   * POST /enrichment/scoring-models - Create scoring model
   */
  .post(
    '/scoring-models',
    async ({ body }) => {
      const model = await enrichmentService.createScoringModel(db, {
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        type: body.type || 'scoring',
        model: body.model || 'openai/gpt-4o-mini',
        prompt: body.prompt,
        temperature: body.temperature !== undefined ? String(body.temperature) : '0.7',
        maxTokens: body.maxTokens || 500,
        isTemplate: body.isTemplate || false,
        ownerId: body.ownerId,
        tags: body.tags || [],
        metadata: body.metadata || {},
        createdBy: body.createdBy,
      });

      return model;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal('scoring'),
            t.Literal('classification'),
            t.Literal('enhancement'),
            t.Literal('qualification'),
          ])
        ),
        model: t.Optional(t.String()),
        prompt: t.String(),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        isTemplate: t.Optional(t.Boolean()),
        ownerId: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Create scoring model',
        description: 'Create a new scoring model template or custom model',
      },
    }
  )

  /**
   * GET /enrichment/ab-tests - List A/B tests
   */
  .get(
    '/ab-tests',
    async ({ query }) => {
      const tests = await enrichmentService.listAbTests(
        db,
        query.workspaceId,
        {
          status: query.status,
          limit: query.limit,
          offset: query.offset,
        }
      );

      return tests;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(
          t.Union([
            t.Literal('draft'),
            t.Literal('running'),
            t.Literal('completed'),
            t.Literal('cancelled'),
          ])
        ),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'List A/B tests',
        description: 'List all A/B tests for a workspace',
      },
    }
  )

  /**
   * POST /enrichment/ab-tests - Create A/B test
   */
  .post(
    '/ab-tests',
    async ({ body }) => {
      const test = await enrichmentService.createAbTest(db, {
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        sampleSize: body.sampleSize || 50,
        sourceListId: body.sourceListId,
        model: body.model || 'openai/gpt-4o-mini',
        temperature: body.temperature !== undefined ? String(body.temperature) : '0.7',
        maxTokens: body.maxTokens || 500,
        variantAPrompt: body.variantAPrompt,
        variantBPrompt: body.variantBPrompt,
        variantAName: body.variantAName || 'Control',
        variantBName: body.variantBName || 'Variant B',
        ownerId: body.ownerId,
        metadata: body.metadata || {},
        createdBy: body.createdBy,
      });

      return test;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        sampleSize: t.Optional(t.Number()),
        sourceListId: t.String(),
        model: t.Optional(t.String()),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        variantAPrompt: t.String(),
        variantBPrompt: t.String(),
        variantAName: t.Optional(t.String()),
        variantBName: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Create A/B test',
        description: 'Create a new A/B test for comparing two enrichment prompts',
      },
    }
  )

  /**
   * GET /enrichment/ab-tests/:id - Get A/B test
   */
  .get(
    '/ab-tests/:id',
    async ({ params, query }) => {
      const test = await enrichmentService.getAbTest(
        db,
        params.id,
        query.workspaceId
      );

      return test;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Get A/B test',
        description: 'Get details for a specific A/B test',
      },
    }
  )

  /**
   * POST /enrichment/ab-tests/:id/run - Run A/B test
   */
  .post(
    '/ab-tests/:id/run',
    async ({ params, body }) => {
      await enrichmentService.runAbTest(
        db,
        params.id,
        body.workspaceId
      );

      return { success: true, message: 'A/B test started' };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Run A/B test',
        description: 'Execute both variants of an A/B test and compare results',
      },
    }
  )

  /**
   * POST /enrichment/ab-tests/:id/promote - Promote winner
   */
  .post(
    '/ab-tests/:id/promote',
    async ({ params, body }) => {
      const model = await enrichmentService.promoteAbTestWinner(
        db,
        params.id,
        body.workspaceId
      );

      return { success: true, model };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Promote A/B test winner',
        description: 'Create a scoring model from the winning variant',
      },
    }
  )

  /**
   * GET /enrichment/analytics - Get enrichment analytics
   */
  .get(
    '/analytics',
    async ({ query }) => {
      const filters: any = {};

      if (query.startDate) {
        filters.startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        filters.endDate = new Date(query.endDate);
      }
      if (query.listId) {
        filters.listId = query.listId;
      }
      if (query.model) {
        filters.model = query.model;
      }

      const analytics = await enrichmentService.getAnalytics(
        db,
        query.workspaceId,
        filters
      );

      return analytics;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        listId: t.Optional(t.String()),
        model: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Get enrichment analytics',
        description: 'Get analytics dashboard data for enrichment jobs',
      },
    }
  )

  /**
   * GET /enrichment/analytics/export - Export analytics to CSV
   */
  .get(
    '/analytics/export',
    async ({ query, set }) => {
      const filters: any = {};

      if (query.startDate) {
        filters.startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        filters.endDate = new Date(query.endDate);
      }
      if (query.listId) {
        filters.listId = query.listId;
      }
      if (query.model) {
        filters.model = query.model;
      }

      const csv = await enrichmentService.exportAnalyticsToCsv(
        db,
        query.workspaceId,
        filters
      );

      // Set response headers for CSV download
      set.headers['Content-Type'] = 'text/csv';
      set.headers['Content-Disposition'] = 'attachment; filename="enrichment-analytics.csv"';

      return csv;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        listId: t.Optional(t.String()),
        model: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Export analytics to CSV',
        description: 'Export enrichment analytics data as CSV file',
      },
    }
  )

  /**
   * GET /enrichment/scoring-models/:id - Get scoring model
   */
  .get(
    '/scoring-models/:id',
    async ({ params, query }) => {
      const model = await enrichmentService.getScoringModel(
        db,
        params.id,
        query.workspaceId
      );

      if (!model) {
        return {
          error: 'Scoring model not found',
        };
      }

      return model;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Get scoring model',
        description: 'Get scoring model details',
      },
    }
  )

  /**
   * PUT /enrichment/scoring-models/:id - Update scoring model
   */
  .put(
    '/scoring-models/:id',
    async ({ params, body }) => {
      const model = await enrichmentService.updateScoringModel(
        db,
        params.id,
        body.workspaceId,
        {
          name: body.name,
          description: body.description,
          prompt: body.prompt,
          temperature: body.temperature !== undefined ? String(body.temperature) : undefined,
          maxTokens: body.maxTokens,
          tags: body.tags,
          metadata: body.metadata,
          updatedBy: body.updatedBy,
        }
      );

      if (!model) {
        return {
          error: 'Scoring model not found',
        };
      }

      return model;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        prompt: t.Optional(t.String()),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Update scoring model',
        description: 'Update scoring model details',
      },
    }
  )

  /**
   * DELETE /enrichment/scoring-models/:id - Delete scoring model
   */
  .delete(
    '/scoring-models/:id',
    async ({ params, query }) => {
      const model = await enrichmentService.deleteScoringModel(
        db,
        params.id,
        query.workspaceId
      );

      if (!model) {
        return {
          error: 'Scoring model not found',
        };
      }

      return {
        success: true,
        model,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment'],
        summary: 'Delete scoring model',
        description: 'Soft delete a scoring model',
      },
    }
  )

  // ========================================================================
  // LEAD ENRICHMENT CONFIG ENDPOINTS (CRM-004)
  // ========================================================================

  /**
   * GET /enrichment/config - Get workspace enrichment config
   */
  .get(
    '/config',
    async ({ query }) => {
      const { leadEnrichmentConfigs } = await import('@agios/db');
      const { eq } = await import('drizzle-orm');

      let config = await db.query.leadEnrichmentConfigs.findFirst({
        where: eq(leadEnrichmentConfigs.workspaceId, query.workspaceId),
      });

      // Return default config if none exists
      if (!config) {
        return {
          workspaceId: query.workspaceId,
          autoEnrichNewLeads: true,
          autoEnrichFields: ['industry', 'employee_count', 'annual_revenue', 'technologies'],
          provider: 'mock',
          rateLimitPerHour: 100,
          linkedinRateLimitPerHour: 5,
          zerobounceRateLimitPerHour: 20,
          websearchRateLimitPerHour: 60,
          linkedinCostPerCall: '0.0100',
          zerobounceCostPerCall: '0.0080',
          websearchCostPerCall: '0.0050',
          budgetLimitMonthly: null,
          budgetUsedThisMonth: '0',
          budgetResetDay: 1,
          minConfidenceToApply: '0.70',
          apiKeyConfigured: {
            linkedin: !!process.env.RAPIDAPI_LINKEDIN_KEY,
            zerobounce: !!process.env.ZEROBOUNCE_API_KEY,
            brave: !!process.env.BRAVE_SEARCH_API_KEY,
            perplexity: !!process.env.PERPLEXITY_API_KEY,
          },
        };
      }

      return {
        ...config,
        apiKeyConfigured: {
          linkedin: !!process.env.RAPIDAPI_LINKEDIN_KEY,
          zerobounce: !!process.env.ZEROBOUNCE_API_KEY,
          brave: !!process.env.BRAVE_SEARCH_API_KEY,
          perplexity: !!process.env.PERPLEXITY_API_KEY,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment Config'],
        summary: 'Get enrichment config',
        description: 'Get workspace lead enrichment configuration including provider settings and rate limits',
      },
    }
  )

  /**
   * PATCH /enrichment/config - Update workspace enrichment config
   */
  .patch(
    '/config',
    async ({ body }) => {
      const { leadEnrichmentConfigs } = await import('@agios/db');
      const { eq } = await import('drizzle-orm');

      // Check if config exists
      let config = await db.query.leadEnrichmentConfigs.findFirst({
        where: eq(leadEnrichmentConfigs.workspaceId, body.workspaceId),
      });

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Map body fields to update data
      if (body.autoEnrichNewLeads !== undefined) updateData.autoEnrichNewLeads = body.autoEnrichNewLeads;
      if (body.autoEnrichFields !== undefined) updateData.autoEnrichFields = body.autoEnrichFields;
      if (body.provider !== undefined) updateData.provider = body.provider;
      if (body.rateLimitPerHour !== undefined) updateData.rateLimitPerHour = body.rateLimitPerHour;
      if (body.linkedinRateLimitPerHour !== undefined) updateData.linkedinRateLimitPerHour = body.linkedinRateLimitPerHour;
      if (body.zerobounceRateLimitPerHour !== undefined) updateData.zerobounceRateLimitPerHour = body.zerobounceRateLimitPerHour;
      if (body.websearchRateLimitPerHour !== undefined) updateData.websearchRateLimitPerHour = body.websearchRateLimitPerHour;
      if (body.linkedinCostPerCall !== undefined) updateData.linkedinCostPerCall = String(body.linkedinCostPerCall);
      if (body.zerobounceCostPerCall !== undefined) updateData.zerobounceCostPerCall = String(body.zerobounceCostPerCall);
      if (body.websearchCostPerCall !== undefined) updateData.websearchCostPerCall = String(body.websearchCostPerCall);
      if (body.budgetLimitMonthly !== undefined) updateData.budgetLimitMonthly = body.budgetLimitMonthly ? String(body.budgetLimitMonthly) : null;
      if (body.budgetResetDay !== undefined) updateData.budgetResetDay = body.budgetResetDay;
      if (body.minConfidenceToApply !== undefined) updateData.minConfidenceToApply = String(body.minConfidenceToApply);
      if (body.updatedBy !== undefined) updateData.updatedBy = body.updatedBy;

      if (config) {
        // Update existing config
        const [updated] = await db
          .update(leadEnrichmentConfigs)
          .set(updateData)
          .where(eq(leadEnrichmentConfigs.workspaceId, body.workspaceId))
          .returning();

        return {
          success: true,
          config: updated,
        };
      } else {
        // Create new config
        const [created] = await db
          .insert(leadEnrichmentConfigs)
          .values({
            workspaceId: body.workspaceId,
            ...updateData,
          })
          .returning();

        return {
          success: true,
          config: created,
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        autoEnrichNewLeads: t.Optional(t.Boolean()),
        autoEnrichFields: t.Optional(t.Array(t.String())),
        provider: t.Optional(
          t.Union([
            t.Literal('mock'),
            t.Literal('clearbit'),
            t.Literal('zoominfo'),
            t.Literal('real'),
            t.Literal('hybrid'),
          ])
        ),
        rateLimitPerHour: t.Optional(t.Number()),
        linkedinRateLimitPerHour: t.Optional(t.Number()),
        zerobounceRateLimitPerHour: t.Optional(t.Number()),
        websearchRateLimitPerHour: t.Optional(t.Number()),
        linkedinCostPerCall: t.Optional(t.Number()),
        zerobounceCostPerCall: t.Optional(t.Number()),
        websearchCostPerCall: t.Optional(t.Number()),
        budgetLimitMonthly: t.Optional(t.Number()),
        budgetResetDay: t.Optional(t.Number()),
        minConfidenceToApply: t.Optional(t.Number()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment Config'],
        summary: 'Update enrichment config',
        description: 'Update workspace lead enrichment configuration',
      },
    }
  )

  /**
   * GET /enrichment/config/costs - Get cost summary
   */
  .get(
    '/config/costs',
    async ({ query }) => {
      const { leadEnrichmentConfigs, leadEnrichments } = await import('@agios/db');
      const { eq, and, gte, sql } = await import('drizzle-orm');

      // Get config
      const config = await db.query.leadEnrichmentConfigs.findFirst({
        where: eq(leadEnrichmentConfigs.workspaceId, query.workspaceId),
      });

      // Calculate start of current month based on budget reset day
      const now = new Date();
      const resetDay = config?.budgetResetDay ?? 1;
      let periodStart: Date;

      if (now.getDate() >= resetDay) {
        periodStart = new Date(now.getFullYear(), now.getMonth(), resetDay);
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, resetDay);
      }

      // Get cost stats for current period
      const costStats = await db
        .select({
          totalCost: sql<string>`COALESCE(SUM(actual_cost), 0)`,
          enrichmentCount: sql<number>`COUNT(*)`,
          successCount: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
          failedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
        })
        .from(leadEnrichments)
        .where(
          and(
            eq(leadEnrichments.workspaceId, query.workspaceId),
            gte(leadEnrichments.createdAt, periodStart)
          )
        );

      const stats = costStats[0] || { totalCost: '0', enrichmentCount: 0, successCount: 0, failedCount: 0 };

      return {
        workspaceId: query.workspaceId,
        currentPeriod: {
          start: periodStart.toISOString(),
          end: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, resetDay).toISOString(),
        },
        costs: {
          total: parseFloat(stats.totalCost),
          budgetLimit: config?.budgetLimitMonthly ? parseFloat(config.budgetLimitMonthly) : null,
          budgetRemaining: config?.budgetLimitMonthly
            ? parseFloat(config.budgetLimitMonthly) - parseFloat(stats.totalCost)
            : null,
          budgetUsedPercent: config?.budgetLimitMonthly
            ? (parseFloat(stats.totalCost) / parseFloat(config.budgetLimitMonthly)) * 100
            : null,
        },
        enrichments: {
          total: stats.enrichmentCount,
          successful: stats.successCount,
          failed: stats.failedCount,
          successRate: stats.enrichmentCount > 0
            ? (stats.successCount / stats.enrichmentCount) * 100
            : 0,
        },
        rates: {
          linkedinCostPerCall: config?.linkedinCostPerCall ? parseFloat(config.linkedinCostPerCall) : 0.01,
          zerobounceCostPerCall: config?.zerobounceCostPerCall ? parseFloat(config.zerobounceCostPerCall) : 0.008,
          websearchCostPerCall: config?.websearchCostPerCall ? parseFloat(config.websearchCostPerCall) : 0.005,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment Config'],
        summary: 'Get cost summary',
        description: 'Get enrichment cost summary for current billing period',
      },
    }
  )

  /**
   * POST /enrichment/config/test-connection - Test provider API connections
   */
  .post(
    '/config/test-connection',
    async ({ body }) => {
      const results: Record<string, { connected: boolean; message: string }> = {};

      // Test LinkedIn (RapidAPI)
      if (process.env.RAPIDAPI_LINKEDIN_KEY) {
        try {
          const { LinkedInProvider } = await import('../../../lib/providers/linkedin');
          const provider = new LinkedInProvider();
          // Just verify API key exists - don't make actual call
          results.linkedin = { connected: true, message: 'API key configured' };
        } catch (error) {
          results.linkedin = { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
        }
      } else {
        results.linkedin = { connected: false, message: 'RAPIDAPI_LINKEDIN_KEY not configured' };
      }

      // Test ZeroBounce
      if (process.env.ZEROBOUNCE_API_KEY) {
        try {
          const { ZeroBounceProvider } = await import('../../../lib/providers/zerobounce');
          const provider = new ZeroBounceProvider();
          const credits = await provider.getCredits();
          results.zerobounce = {
            connected: credits !== null,
            message: credits !== null ? `Connected (${credits} credits remaining)` : 'Could not verify credits',
          };
        } catch (error) {
          results.zerobounce = { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
        }
      } else {
        results.zerobounce = { connected: false, message: 'ZEROBOUNCE_API_KEY not configured' };
      }

      // Test Brave Search
      if (process.env.BRAVE_SEARCH_API_KEY) {
        results.brave = { connected: true, message: 'API key configured' };
      } else {
        results.brave = { connected: false, message: 'BRAVE_SEARCH_API_KEY not configured' };
      }

      // Test Perplexity
      if (process.env.PERPLEXITY_API_KEY) {
        results.perplexity = { connected: true, message: 'API key configured' };
      } else {
        results.perplexity = { connected: false, message: 'PERPLEXITY_API_KEY not configured' };
      }

      return {
        success: true,
        providers: results,
        allConnected: Object.values(results).every(r => r.connected),
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment Config'],
        summary: 'Test provider connections',
        description: 'Test API connections for all configured enrichment providers',
      },
    }
  );
