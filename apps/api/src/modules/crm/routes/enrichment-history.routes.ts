/**
 * Enrichment History Routes
 * REST endpoints for enrichment history with SSE streaming
 *
 * Epic: Backend API & Services for Enrichment History
 * Story: US-ENRICH-HIST-002
 */

import { Elysia, t } from 'elysia';
import { enrichmentHistoryService } from '../services/enrichment-history.service';
import { sql } from 'drizzle-orm';

export const enrichmentHistoryRoutes = new Elysia({ prefix: '/enrichment-history' })
  /**
   * GET /recent - Get recent history entries for initial state (CQRS pattern)
   */
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24h
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50;

      // Get history for the entity
      const { history, totalCount } = await enrichmentHistoryService.getHistory(db, {
        workspaceId: query.workspaceId,
        entityId: query.entityId,
        entityType: query.entityType,
        limit,
        offset: 0,
      });

      return {
        serverTimestamp: new Date().toISOString(),
        history,
        totalCount,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityId: t.String(),
        entityType: t.Union([t.Literal('contact'), t.Literal('lead')]),
        seconds: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment History'],
        summary: 'Get recent enrichment history',
        description:
          'Fetch recent enrichment history for an entity (CQRS pattern - initial state)',
      },
    }
  )

  /**
   * GET /stream - SSE streaming for real-time updates (CQRS pattern)
   */
  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(
        `[enrichment-history/stream] Starting stream for workspace ${query.workspaceId}${
          query.entityId ? ` entity ${query.entityId}` : ''
        }`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const { streamEnrichmentHistory } = await import('../../../lib/electric-shapes');

        const electric = streamEnrichmentHistory(
          query.workspaceId,
          query.entityId,
          query.entityType,
          subscriptionTimestamp
        );

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[enrichment-history/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityId: t.Optional(t.String()),
        entityType: t.Optional(t.Union([t.Literal('contact'), t.Literal('lead')])),
      }),
      detail: {
        tags: ['Enrichment History'],
        summary: 'Stream enrichment history updates',
        description:
          'Stream real-time enrichment history updates via SSE (CQRS pattern - deltas)',
      },
    }
  )

  /**
   * GET / - List enrichment history with pagination
   */
  .get(
    '/',
    async ({ db, query }) => {
      const page = query.page ? Math.max(1, parseInt(query.page, 10)) : 1;
      const limit = query.limit ? Math.min(100, Math.max(1, parseInt(query.limit, 10))) : 50;
      const offset = (page - 1) * limit;

      const { history, totalCount } = await enrichmentHistoryService.getHistory(db, {
        workspaceId: query.workspaceId,
        entityId: query.entityId,
        entityType: query.entityType,
        limit,
        offset,
      });

      return {
        history,
        pagination: {
          total: totalCount,
          limit,
          offset,
          page,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityId: t.String(),
        entityType: t.Union([t.Literal('contact'), t.Literal('lead')]),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Enrichment History'],
        summary: 'List enrichment history with pagination',
        description: 'List enrichment history entries for an entity with pagination',
      },
    }
  )

  /**
   * GET /:id - Get single history entry with full content
   */
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const entry = await enrichmentHistoryService.getEntry(
        db,
        params.id,
        query.workspaceId
      );

      if (!entry) {
        return {
          error: 'History entry not found',
          status: 404,
        };
      }

      return entry;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment History'],
        summary: 'Get enrichment history entry',
        description: 'Get a single enrichment history entry with full report content',
      },
    }
  )

  /**
   * DELETE /:id - Delete history entry (with reference counting cleanup)
   */
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      try {
        await enrichmentHistoryService.deleteEntry(db, params.id, query.workspaceId);

        return {
          success: true,
          message: 'History entry deleted',
        };
      } catch (error) {
        return {
          error: 'Failed to delete history entry',
          message: error instanceof Error ? error.message : String(error),
          status: 500,
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Enrichment History'],
        summary: 'Delete enrichment history entry',
        description: 'Delete an enrichment history entry (with content reference cleanup)',
      },
    }
  );
