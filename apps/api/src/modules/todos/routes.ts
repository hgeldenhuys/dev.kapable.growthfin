/**
 * Todos Routes
 * Real-time streaming of extracted todos from Claude Code sessions using ElectricSQL
 *
 * Implements CQRS with reactive queries (NO POLLING):
 * - GET /recent - Initial state (last N seconds) - LEGACY (claude_sessions)
 * - GET /stream - Reactive delta updates via ElectricSQL + SSE - LEGACY
 * - GET /latest - Latest todos from persistent todos table - NEW
 * - GET /history - Session-grouped todo history - NEW
 */

import { Elysia, t } from 'elysia';
import { claudeSessions, todos, type TodoItem } from '@agios/db/schema';
import { gte, and, eq, desc } from 'drizzle-orm';
import { streamTodos, streamPersistentTodos } from '../../lib/electric-shapes';
import { todoService } from './service';

export const todosRoutes = new Elysia({ prefix: '/todos', tags: ['Todos'] })
  /**
   * Get latest todos (NEW persistent storage)
   * Returns current working set of todos for a project+agent
   */
  .get(
    '/latest',
    async ({ query, db }) => {
      const projectId = query.projectId;
      const agentId = query.agentId || 'main';

      if (!projectId) {
        return {
          error: 'projectId is required',
          todos: [],
        };
      }

      // Handle different wildcard scenarios
      let latestTodos;

      if (projectId === '_') {
        // Wildcard project - get all todos (optionally filtered by agent)
        latestTodos = await todoService.getAllLatest(db, agentId === '_' ? undefined : agentId);
      } else if (agentId === '_') {
        // Specific project, but wildcard agent - get all agents for this project
        latestTodos = await todoService.getAllLatestForProject(db, projectId);
      } else {
        // Specific project and agent
        latestTodos = await todoService.getLatest(
          db,
          projectId,
          agentId,
          false // Only latest, not historical
        );
      }

      return {
        projectId,
        agentId,
        todos: latestTodos,
        count: latestTodos.length,
      };
    },
    {
      query: t.Object({
        projectId: t.String({ description: 'Project ID to filter todos' }),
        agentId: t.Optional(t.String({ description: 'Agent type (defaults to "main")' })),
      }),
      detail: {
        summary: 'Get latest todos from persistent storage',
        description:
          'Returns the current working set of todos for a project+agent. These persist across sessions.',
      },
    }
  )

  /**
   * Get todo history grouped by session (NEW)
   */
  .get(
    '/history',
    async ({ query, db }) => {
      const sessions = await todoService.getBySession(
        db,
        query.projectId,
        query.agentId,
        query.includeHistorical !== false // Default to true
      );

      return {
        sessions,
        count: sessions.length,
      };
    },
    {
      query: t.Object({
        projectId: t.Optional(t.String({ description: 'Project ID to filter' })),
        agentId: t.Optional(t.String({ description: 'Agent type to filter' })),
        includeHistorical: t.Optional(t.Boolean({ description: 'Include historical sessions' })),
      }),
      detail: {
        summary: 'Get todo history grouped by session',
        description: 'Returns todos organized by session with metadata',
      },
    }
  )

  /**
   * Stream persistent todos in real-time (NEW)
   * Real-time SSE updates from the todos table using ElectricSQL
   */
  .get(
    '/stream-latest',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const projectId = query.projectId;
      const agentId = query.agentId;

      if (!projectId) {
        yield `data: ${JSON.stringify({ error: 'projectId is required' })}\n\n`;
        return;
      }

      // Subscription timestamp - only events AFTER this will be streamed
      const subscriptionTimestamp = new Date();

      console.log(
        `[todos/stream-latest] Starting stream for project ${projectId}, agent ${agentId || 'all'}`
      );

      // Send initial connection confirmation
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream persistent todos via Electric with offset=now (no historical data!)
        const electric = streamPersistentTodos(projectId, agentId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[todos/stream-latest] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        projectId: t.String({ description: 'Project ID to filter todos' }),
        agentId: t.Optional(t.String({ description: 'Agent type to filter' })),
      }),
      detail: {
        summary: 'Stream persistent todos in real-time',
        description:
          'Stream NEW todo updates from persistent storage via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )

  /**
   * Get recent sessions with todos (LEGACY - claude_sessions table)
   * Returns initial state for SSE streaming
   */
  .get(
    '/recent',
    async ({ query, db }) => {
      const seconds = query.seconds || 30;
      const since = new Date(Date.now() - seconds * 1000);
      const serverTimestamp = new Date().toISOString();

      const conditions = [gte(claudeSessions.updatedAt, since)];

      if (query.projectId) {
        conditions.push(eq(claudeSessions.projectId, query.projectId));
      }

      const sessions = await db
        .select({
          id: claudeSessions.id,
          projectId: claudeSessions.projectId,
          currentTodoTitle: claudeSessions.currentTodoTitle,
          todos: claudeSessions.todos,
          updatedAt: claudeSessions.updatedAt,
          createdAt: claudeSessions.createdAt,
        })
        .from(claudeSessions)
        .where(and(...conditions))
        .orderBy(desc(claudeSessions.updatedAt));

      // Flatten todos with session context
      const todosList = sessions.flatMap((session) =>
        (session.todos || []).map((todo: TodoItem) => ({
          sessionId: session.id,
          sessionTitle: session.currentTodoTitle,
          projectId: session.projectId,
          todo,
          updatedAt: session.updatedAt,
        }))
      );

      return {
        serverTimestamp,
        sessions, // Full session data
        todos: todosList, // Flattened todos
      };
    },
    {
      query: t.Object({
        seconds: t.Optional(t.Number()),
        projectId: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get recent sessions with todos',
        description:
          'Returns sessions with todos from last N seconds. Use serverTimestamp for SSE stream.',
      },
    }
  )

  /**
   * Stream new sessions with todos
   * Real-time SSE updates for todo changes using ElectricSQL (NO POLLING)
   */
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

      console.log(`[todos/stream] Starting stream for project ${projectId}`);

      // Send initial connection confirmation
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream todos via Electric with offset=now (no historical data!)
        const electric = streamTodos(projectId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[todos/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        projectId: t.String({ description: 'Project ID to filter todos' }),
      }),
      detail: {
        summary: 'Stream new sessions with todos',
        description:
          'Stream NEW todo updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )

  /**
   * Get todos for a specific session
   */
  .get(
    '/session/:sessionId',
    async ({ params, error, db }) => {
      const session = await db.query.claudeSessions.findFirst({
        where: eq(claudeSessions.id, params.sessionId),
        columns: {
          id: true,
          projectId: true,
          currentTodoTitle: true,
          todos: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      if (!session) {
        return error(404, { error: 'Session not found' });
      }

      return {
        session,
        todos: session.todos || [],
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        summary: 'Get todos for a specific session',
      },
    }
  );
