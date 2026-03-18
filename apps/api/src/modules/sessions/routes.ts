/**
 * Sessions Routes
 * Real-time SSE streaming for Claude Code sessions using ElectricSQL
 *
 * Implements CQRS with reactive queries (NO POLLING):
 * - GET /recent - Initial state (last N seconds)
 * - GET /stream - Reactive delta updates via ElectricSQL + SSE
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { claudeSessions } from '@agios/db/schema';
import { desc, gte, eq, and } from 'drizzle-orm';
import { streamSessions } from '../../lib/electric-shapes';

export const sessionsRoutes = new Elysia({ prefix: '/sessions' })
  .get(
    '/recent',
    async ({ query }) => {
      const seconds = query.seconds || 30;
      const projectId = query.projectId;

      const since = new Date(Date.now() - seconds * 1000);
      const serverTimestamp = new Date().toISOString();

      const conditions = [gte(claudeSessions.updatedAt, since)];
      if (projectId) {
        conditions.push(eq(claudeSessions.projectId, projectId));
      }

      const sessions = await db
        .select()
        .from(claudeSessions)
        .where(and(...conditions))
        .orderBy(desc(claudeSessions.updatedAt));

      return {
        serverTimestamp,
        sessions,
      };
    },
    {
      query: t.Object({
        seconds: t.Optional(t.Number()),
        projectId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Sessions'],
        summary: 'Get recent sessions',
        description: 'Fetch recent sessions for initial state',
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

      if (!projectId) {
        yield `data: ${JSON.stringify({ error: 'projectId is required' })}\n\n`;
        return;
      }

      // Subscription timestamp - only events AFTER this will be streamed
      const subscriptionTimestamp = new Date();

      console.log(`[sessions/stream] Starting stream for project ${projectId}`);

      // Send initial connection confirmation
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream sessions via Electric with offset=now (no historical data!)
        const electric = streamSessions(projectId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[sessions/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        projectId: t.String({ description: 'Project ID to filter sessions' }),
      }),
      detail: {
        tags: ['Sessions'],
        summary: 'Stream session updates',
        description: 'Stream NEW session updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  );
