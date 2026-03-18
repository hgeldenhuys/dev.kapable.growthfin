/**
 * Activity Routes
 * REST endpoints for task, call, meeting, and email tracking with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { activityService } from '../services/activities';
import { streamActivities } from '../../../lib/electric-shapes';

export const activityRoutes = new Elysia({ prefix: '/activities' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;
      const activities = await activityService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        activities,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Activities'],
        summary: 'Get recent activities',
        description: 'Fetch recent activities for initial state (CQRS pattern)',
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

      console.log(`[activities/stream] Starting stream for workspace ${query.workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamActivities(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[activities/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Activities'],
        summary: 'Stream activity updates',
        description: 'Stream NEW activity updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      return activityService.list(db, {
        workspaceId: query.workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        assigneeId: query.assigneeId,
        status: query.status,
        type: query.type,
        contactId: query.contactId,
        accountId: query.accountId,
        opportunityId: query.opportunityId,
        leadId: query.leadId,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        assigneeId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        type: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        opportunityId: t.Optional(t.String()),
        leadId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/',
    async ({ db, body }) => {
      // Default assigneeId, createdBy, updatedBy — never use non-UUID fallbacks
      const userId = body.createdBy || body.assigneeId;
      const data = {
        ...body,
        assigneeId: body.assigneeId || userId,
        createdBy: userId,
        updatedBy: body.updatedBy || userId,
      };
      return activityService.create(db, data);
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        type: t.String(),
        subject: t.String(),
        assigneeId: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
        updatedBy: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        opportunityId: t.Optional(t.String()),
        leadId: t.Optional(t.String()),
        description: t.Optional(t.String()),
        dueDate: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        status: t.Optional(t.String()),
        outcome: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
      }),
    }
  )
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const activity = await activityService.getById(db, params.id, query.workspaceId);
      if (!activity) {
        throw new Error('Activity not found');
      }
      return activity;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      const activity = await activityService.update(db, params.id, query.workspaceId, body);
      if (!activity) {
        throw new Error('Activity not found');
      }
      return activity;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        subject: t.Optional(t.String()),
        description: t.Optional(t.String()),
        dueDate: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        status: t.Optional(t.String()),
        completedDate: t.Optional(t.String()),
        assigneeId: t.Optional(t.String()),
        outcome: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        updatedBy: t.String(),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
      }),
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      await activityService.delete(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .get(
    '/overdue',
    async ({ db, query }) => {
      return activityService.getOverdue(db, query.assigneeId, query.workspaceId);
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        assigneeId: t.String(),
      }),
    }
  )
  .get(
    '/contacts/:contactId',
    async ({ db, params, query }) => {
      return activityService.getByContact(db, params.contactId, query.workspaceId);
    },
    {
      params: t.Object({ contactId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Activities'],
        summary: 'Get activities for a contact',
      },
    }
  )
  .get(
    '/accounts/:accountId',
    async ({ db, params, query }) => {
      return activityService.getByAccount(db, params.accountId, query.workspaceId);
    },
    {
      params: t.Object({ accountId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Activities'],
        summary: 'Get activities for an account',
      },
    }
  )
  .get(
    '/opportunities/:opportunityId',
    async ({ db, params, query }) => {
      return activityService.getByOpportunity(db, params.opportunityId, query.workspaceId);
    },
    {
      params: t.Object({ opportunityId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Activities'],
        summary: 'Get activities for an opportunity',
      },
    }
  )
  .post(
    '/call-disposition',
    async ({ db, body }) => {
      const result = await activityService.logCallDisposition(db, {
        workspaceId: body.workspaceId,
        leadId: body.leadId,
        disposition: body.disposition,
        notes: body.notes,
        callbackDate: body.callbackDate ? new Date(body.callbackDate) : undefined,
        duration: body.duration,
        userId: body.userId,
      });

      return result;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        leadId: t.String(),
        disposition: t.Union([
          t.Literal('ntu'),
          t.Literal('rpc_interested'),
          t.Literal('rpc_not_interested'),
          t.Literal('callback_scheduled'),
          t.Literal('wpc'),
          t.Literal('npc'),
        ]),
        notes: t.Optional(t.String({ maxLength: 500 })),
        callbackDate: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        userId: t.String(),
      }),
      detail: {
        tags: ['Activities', 'Agent Dashboard'],
        summary: 'Log call disposition',
        description:
          'Quick call disposition logging for agents. Updates lead status based on disposition rules and creates timeline event. Target: <300ms response time.',
      },
    }
  );
