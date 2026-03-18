/**
 * Opportunity Routes
 * REST endpoints for opportunity/deal CRUD operations with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { opportunityService } from '../services/opportunities';
import { timelineService } from '../services/timeline';
import { streamOpportunities } from '../../../lib/electric-shapes';
import { outcomeService } from '../services/outcome';

export const opportunityRoutes = new Elysia({ prefix: '/opportunities' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;
      const opportunities = await opportunityService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        opportunities,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Opportunities'],
        summary: 'Get recent opportunities',
        description: 'Fetch recent opportunities for initial state (CQRS pattern)',
      },
    }
  )
  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[opportunities/stream] Starting stream for workspace ${query.workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamOpportunities(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[opportunities/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Opportunities'],
        summary: 'Stream opportunity updates',
        description: 'Stream NEW opportunity updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      return opportunityService.list(db, {
        workspaceId: query.workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        stage: query.stage,
        status: query.status,
        ownerId: query.ownerId,
        accountId: query.accountId,
        contactId: query.contactId,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        stage: t.Optional(t.String()),
        status: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/',
    async ({ db, body }) => {
      // Map route field names to database field names
      const { createdById, updatedById, ...rest } = body;
      return opportunityService.create(db, {
        ...rest,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        createdBy: createdById || body.ownerId,
        updatedBy: updatedById || body.ownerId,
      });
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        ownerId: t.String(),
        createdById: t.Optional(t.String()),
        updatedById: t.Optional(t.String()),
        amount: t.String(),
        accountId: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        stage: t.Optional(t.String()),
        expectedCloseDate: t.Optional(t.String()),
        leadSource: t.Optional(t.String()),
        status: t.Optional(t.String()),
        customFields: t.Optional(t.Any()),
      }),
    }
  )
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const opportunity = await opportunityService.getById(db, params.id, query.workspaceId);
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      return opportunity;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      // Map route field names to database field names
      const { updatedById, ...rest } = body;
      const opportunity = await opportunityService.update(db, params.id, query.workspaceId, {
        ...rest,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        actualCloseDate: body.actualCloseDate ? new Date(body.actualCloseDate) : undefined,
        updatedBy: updatedById,
      });
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      return opportunity;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        amount: t.Optional(t.String()),
        stage: t.Optional(t.String()),
        status: t.Optional(t.String()),
        probability: t.Optional(t.Number()),
        expectedCloseDate: t.Optional(t.String()),
        actualCloseDate: t.Optional(t.String()),
        winLossReason: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        updatedById: t.String(),
        customFields: t.Optional(t.Any()),
      }),
    }
  )
  .patch(
    '/:id/stage',
    async ({ db, params, query, body }) => {
      const opportunity = await opportunityService.update(db, params.id, query.workspaceId, {
        stage: body.stage,
        winLossReason: body.winLossReason,
        updatedBy: body.updatedById,
      });
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      return opportunity;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        stage: t.String(),
        winLossReason: t.Optional(t.String()),
        updatedById: t.String(),
      }),
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      await opportunityService.delete(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  /**
   * T-019: Advance Stage Route
   * POST /:id/advance - Advance opportunity to next stage
   */
  .post(
    '/:id/advance',
    async ({ db, params, query, body, set }) => {
      try {
        const opportunity = await outcomeService.advanceStage(
          db,
          params.id,
          query.workspaceId,
          body.stage,
          body.userId
        );
        return opportunity;
      } catch (error) {
        console.error('[opportunities/:id/advance] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to advance opportunity',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        stage: t.Union([
          t.Literal('prospecting'),
          t.Literal('qualification'),
          t.Literal('proposal'),
          t.Literal('negotiation'),
          t.Literal('closed_won'),
          t.Literal('closed_lost'),
        ]),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Opportunities', 'State Machine'],
        summary: 'Advance opportunity stage',
        description: 'Advance opportunity to next stage with auto-probability update (US-CRM-STATE-MACHINE T-013)',
      },
    }
  )
  /**
   * T-019: Close Opportunity Route
   * POST /:id/close - Close opportunity as won or lost
   */
  .post(
    '/:id/close',
    async ({ db, params, query, body, set }) => {
      try {
        const opportunity = await outcomeService.closeOpportunity(
          db,
          params.id,
          query.workspaceId,
          body.outcome,
          {
            amount: body.amount,
            lostReason: body.lostReason,
            notes: body.notes,
            userId: body.userId,
          }
        );
        return opportunity;
      } catch (error) {
        console.error('[opportunities/:id/close] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to close opportunity',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        outcome: t.Union([t.Literal('won'), t.Literal('lost')]),
        amount: t.Optional(t.Number()),
        lostReason: t.Optional(
          t.Union([
            t.Literal('price'),
            t.Literal('competitor'),
            t.Literal('timing'),
            t.Literal('budget'),
            t.Literal('no_decision'),
            t.Literal('other'),
          ])
        ),
        notes: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Opportunities', 'State Machine'],
        summary: 'Close opportunity',
        description: 'Close opportunity as won or lost (US-CRM-STATE-MACHINE T-013)',
      },
    }
  )
  .get(
    '/:id/timeline',
    async ({ db, params, query }) => {
      return timelineService.getByEntity(
        db,
        'opportunity',
        params.id,
        query.workspaceId,
        query.limit ? parseInt(query.limit, 10) : 50
      );
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
    }
  );
