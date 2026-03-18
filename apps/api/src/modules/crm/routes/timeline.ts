/**
 * Timeline Routes
 * REST endpoints for CRM timeline event operations with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { timelineService } from '../services/timeline';
import { streamCRMTimelineEvents } from '../../../lib/electric-shapes';

export const timelineRoutes = new Elysia({ prefix: '/timeline' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;
      const events = await timelineService.getRecent(
        db,
        query.workspaceId,
        seconds,
        query.entityType,
        query.entityId
      );

      return {
        serverTimestamp: new Date().toISOString(),
        events,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
        entityType: t.Optional(t.String()),
        entityId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Timeline'],
        summary: 'Get recent timeline events',
        description: 'Fetch recent timeline events for initial state (CQRS pattern)',
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

      console.log(
        `[timeline/stream] Starting stream for workspace ${query.workspaceId}${
          query.entityType ? `, entity ${query.entityType}/${query.entityId}` : ''
        }`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamCRMTimelineEvents(
          query.workspaceId,
          query.entityType,
          query.entityId,
          subscriptionTimestamp
        );

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[timeline/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Optional(t.String()),
        entityId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Timeline'],
        summary: 'Stream timeline event updates',
        description: 'Stream NEW timeline event updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )
  .get(
    '/events',
    async ({ db, query }) => {
      return timelineService.list(db, {
        workspaceId: query.workspaceId,
        entityType: query.entityType,
        entityId: query.entityId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        eventType: query.eventType,
        eventCategory: query.eventCategory,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Optional(t.String()),
        entityId: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
        eventCategory: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Timeline'],
        summary: 'List timeline events',
        description: 'Query timeline events with optional filtering',
      },
    }
  )
  .post(
    '/events',
    async ({ db, body }) => {
      const eventData: any = {
        ...body,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      };
      return timelineService.create(db, eventData);
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        entityType: t.String(),
        entityId: t.String(),
        eventType: t.String(),
        eventCategory: t.String(),
        eventLabel: t.String(),
        summary: t.String(),
        actorType: t.String(),
        occurredAt: t.Optional(t.String()),
        actorId: t.Optional(t.String()),
        actorName: t.Optional(t.String()),
        description: t.Optional(t.String()),
        communication: t.Optional(t.Any()),
        dataChanges: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Timeline'],
        summary: 'Create timeline event',
        description: 'Create a new timeline event (manual or system)',
      },
    }
  )
  // Pin/unpin routes MUST come before /events/:id to avoid route conflicts
  .post(
    '/events/:id/pin',
    async ({ db, params, query, body }) => {
      return timelineService.pin(db, params.id, query.workspaceId, body.userId);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({ userId: t.String() }),
      detail: {
        tags: ['Timeline'],
        summary: 'Pin timeline event',
        description: 'Pin event to appear first in timeline',
      },
    }
  )
  .delete(
    '/events/:id/pin',
    async ({ db, params, query }) => {
      return timelineService.unpin(db, params.id, query.workspaceId);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Timeline'],
        summary: 'Unpin timeline event',
        description: 'Remove pin from event',
      },
    }
  )
  .get(
    '/events/:id',
    async ({ db, params, query }) => {
      const event = await timelineService.getById(db, params.id, query.workspaceId);
      if (!event) {
        throw new Error('Timeline event not found');
      }
      return event;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Timeline'],
        summary: 'Get timeline event by ID',
      },
    }
  );
