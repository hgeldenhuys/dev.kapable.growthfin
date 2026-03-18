/**
 * Chat Routes
 * Real-time SSE streaming for chat messages using ElectricSQL
 *
 * Implements CQRS with reactive queries (NO POLLING):
 * - GET /recent - Initial state (last N seconds)
 * - GET /stream - Reactive delta updates via ElectricSQL + SSE
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { chatMessages, claudeSessions } from '@agios/db/schema';
import { desc, gte, eq, and } from 'drizzle-orm';
import { streamChatMessages } from '../../lib/electric-shapes';

export const chatRoutes = new Elysia()
  .get(
    '/recent',
    async ({ query }) => {
      const seconds = query.seconds || 30;
      const projectId = query.projectId;
      const sessionId = query.sessionId;
      const agentType = query.agentType;

      const since = new Date(Date.now() - seconds * 1000);
      const serverTimestamp = new Date().toISOString();

      const conditions = [gte(chatMessages.timestamp, since)];
      if (projectId) {
        conditions.push(eq(chatMessages.projectId, projectId));
      }
      if (sessionId) {
        conditions.push(eq(chatMessages.sessionId, sessionId));
      }

      // If agentType is provided and not "_", join with sessions and filter by agent type
      let messages;
      if (agentType && agentType !== '_') {
        messages = await db
          .select({
            id: chatMessages.id,
            hookEventId: chatMessages.hookEventId,
            sessionId: chatMessages.sessionId,
            projectId: chatMessages.projectId,
            transactionId: chatMessages.transactionId,
            role: chatMessages.role,
            message: chatMessages.message,
            type: chatMessages.type,
            timestamp: chatMessages.timestamp,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .innerJoin(claudeSessions, eq(chatMessages.sessionId, claudeSessions.id))
          .where(
            and(
              ...conditions,
              eq(claudeSessions.currentAgentType, agentType)
            )
          )
          .orderBy(desc(chatMessages.timestamp));
      } else {
        // No agent filter or "_" (all agents)
        messages = await db
          .select()
          .from(chatMessages)
          .where(and(...conditions))
          .orderBy(desc(chatMessages.timestamp));
      }

      return {
        serverTimestamp,
        messages,
      };
    },
    {
      query: t.Object({
        seconds: t.Optional(t.Number()),
        projectId: t.Optional(t.String()),
        sessionId: t.Optional(t.String()),
        agentType: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Chat'],
        summary: 'Get recent chat messages',
        description: 'Fetch recent chat messages for initial state, optionally filtered by agent type',
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

      console.log(`[chat/stream] Starting stream for project ${projectId}${sessionId ? `, session ${sessionId}` : ''}`);

      // Send initial connection confirmation
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream chat messages via Electric with offset=now (no historical data!)
        const electric = streamChatMessages(projectId, sessionId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[chat/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        projectId: t.String({ description: 'Project ID to filter chat messages' }),
        sessionId: t.Optional(t.String({ description: 'Optional session ID to filter chat messages' })),
      }),
      detail: {
        tags: ['Chat'],
        summary: 'Stream chat messages',
        description: 'Stream NEW chat messages via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  );
