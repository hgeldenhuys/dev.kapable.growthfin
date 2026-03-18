/**
 * Summaries Routes
 * Real-time SSE streaming for event summaries using ElectricSQL
 *
 * Implements CQRS with reactive queries (NO POLLING):
 * - GET /recent - Initial state (last N seconds)
 * - GET /stream - Reactive delta updates via ElectricSQL + SSE
 */

import { Elysia, t } from 'elysia';
import { eventSummaries, claudeSessions } from '@agios/db/schema';
import { desc, gte, eq, and } from 'drizzle-orm';
import { streamSummaries } from '../../lib/electric-shapes';

export const summariesRoutes = new Elysia({ prefix: '/summaries' })
  .get(
    '/recent',
    async ({ query, db }) => {
      const seconds = query.seconds || 30;
      const projectId = query.projectId;
      const sessionId = query.sessionId;
      const personaId = query.personaId;

      const since = new Date(Date.now() - seconds * 1000);
      const serverTimestamp = new Date().toISOString();

      const conditions = [gte(eventSummaries.createdAt, since)];
      if (projectId) {
        conditions.push(eq(eventSummaries.projectId, projectId));
      }
      if (sessionId) {
        conditions.push(eq(eventSummaries.sessionId, sessionId));
      }

      // If personaId is provided and not "_", join with sessions and filter by persona
      let summaries;
      if (personaId && personaId !== '_') {
        summaries = await db
          .select({
            id: eventSummaries.id,
            hookEventId: eventSummaries.hookEventId,
            hookEventType: eventSummaries.hookEventType,
            summary: eventSummaries.summary,
            sessionId: eventSummaries.sessionId,
            projectId: eventSummaries.projectId,
            transactionId: eventSummaries.transactionId,
            personaId: eventSummaries.personaId,
            role: eventSummaries.role,
            llmConfigId: eventSummaries.llmConfigId,
            createdAt: eventSummaries.createdAt,
          })
          .from(eventSummaries)
          .innerJoin(claudeSessions, eq(eventSummaries.sessionId, claudeSessions.id))
          .where(
            and(
              ...conditions,
              eq(claudeSessions.currentPersonaId, personaId)
            )
          )
          .orderBy(desc(eventSummaries.createdAt));
      } else {
        // No persona filter or "_" (all personas)
        summaries = await db
          .select()
          .from(eventSummaries)
          .where(and(...conditions))
          .orderBy(desc(eventSummaries.createdAt));
      }

      return {
        serverTimestamp,
        summaries,
      };
    },
    {
      query: t.Object({
        seconds: t.Optional(t.Number()),
        projectId: t.Optional(t.String()),
        sessionId: t.Optional(t.String()),
        personaId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Summaries'],
        summary: 'Get recent summaries',
        description: 'Fetch recent event summaries for initial state, optionally filtered by persona',
      },
    }
  )

  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const projectId = query.projectId;
      const sessionId = query.sessionId;

      if (!projectId) {
        yield `data: ${JSON.stringify({ error: 'projectId is required' })}\n\n`;
        return;
      }

      // Subscription timestamp - only events AFTER this will be streamed
      const subscriptionTimestamp = new Date();

      console.log(`[summaries/stream] Starting stream for project ${projectId}${sessionId ? `, session ${sessionId}` : ''}`);

      // Send initial connection confirmation
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream summaries via Electric with offset=now (no historical data!)
        const electric = streamSummaries(projectId, sessionId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[summaries/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        projectId: t.String({ description: 'Project ID to filter summaries' }),
        sessionId: t.Optional(t.String({ description: 'Optional session ID to filter summaries' })),
      }),
      detail: {
        tags: ['Summaries'],
        summary: 'Stream summary updates',
        description: 'Stream NEW summary updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  );
