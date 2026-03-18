/**
 * Hook Events Routes
 * HTTP routes for hook event management
 *
 * Implements CQRS with reactive queries (NO POLLING):
 * - GET /recent - Initial state (last N seconds)
 * - GET /stream - Reactive delta updates via PostgreSQL LISTEN/NOTIFY + SSE
 *
 * Pattern:
 * 1. Client GETs initial state (last 30s)
 * 2. Client connects to SSE stream
 * 3. PostgreSQL trigger fires pg_notify() on INSERT
 * 4. Server immediately pushes event to SSE (zero latency, no polling)
 */

import { Elysia, t } from 'elysia';
import { hookEventService } from './service';
import { streamHookEvents } from '../../lib/electric-shapes';
import { createSignalDBStream } from '../../lib/signaldb-stream';

export const hookEventRoutes = new Elysia()
  // TEST: Simple streaming route to verify Elysia SSE works
  .get('/test-stream', async function* ({ set }) {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    console.log('[test-stream] Starting...');
    yield `: connected\n\n`;

    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const msg = `data: ${JSON.stringify({ test: i, timestamp: new Date().toISOString() })}\n\n`;
      console.log(`[test-stream] Yielding message ${i}`);
      yield msg;
      console.log(`[test-stream] Yielded message ${i} successfully`);
    }

    console.log('[test-stream] Done');
  })
  .get('/', async ({ db, query }) => {
    return hookEventService.list(db, {
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
    }),
  })
  .post('/', async ({ db, body }) => {
    return hookEventService.create(db, body);
  }, {
    body: t.Object({
      projectId: t.String(),
      sessionId: t.String(),
      eventName: t.String(),
      toolName: t.Optional(t.String()),
      tags: t.Optional(t.Array(t.String())), // Accept tags from SDK
      payload: t.Any(),
    }),
  })
  /**
   * GET /:id - Get a single hook event by ID
   */
  .get('/:id', async ({ db, params, set }) => {
    const event = await hookEventService.getById(db, params.id);

    if (!event) {
      set.status = 404;
      return { error: 'Event not found' };
    }

    return event;
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
  })
  /**
   * GET /recent - Get recent hook events (last N seconds)
   * Used for initial state in Electric-SQL pattern
   *
   * IMPORTANT: Returns server timestamp to prevent client/server clock skew issues
   */
  .get('/recent', async ({ db, query }) => {
    const seconds = query.seconds ? parseInt(query.seconds, 10) : 30;
    const projectId = query.projectId;
    const agentType = query.agentType;
    const tag = query.tag;

    const events = await hookEventService.listRecent(db, {
      seconds,
      projectId,
      agentType,
      tag,
    });

    // Return server timestamp to avoid client/server clock skew
    // Client should use this timestamp (or latest event.createdAt) for SSE stream
    return {
      serverTimestamp: new Date().toISOString(),
      events,
      filter: tag ? { type: 'tag', value: tag } : projectId ? { type: 'projectId', value: projectId } : undefined,
    };
  }, {
    query: t.Object({
      seconds: t.Optional(t.String()),
      projectId: t.Optional(t.String()),
      agentType: t.Optional(t.String()),
      tag: t.Optional(t.String()),
    }),
  })
  /**
   * GET /stream - Stream delta hook events via SSE using SignalDB
   *
   * Uses SignalDB for instant event delivery:
   * 1. Client connects
   * 2. Server streams events via SignalDB native SSE
   * 3. Filter by projectId/sessionId/tag
   * 4. Push events instantly via SSE (zero latency)
   *
   * NO POLLING - events are pushed when they occur via SignalDB NOTIFY triggers
   *
   * NOTE: Using ReadableStream instead of async generators due to Elysia bug
   * with nested/infinite generators blocking on yield
   */
  .get('/stream', async ({ query, set }) => {
    const projectId = query.projectId;
    const sessionId = query.sessionId;
    const tag = query.tag;

    // AC-004: Tag takes precedence - if tag is provided, projectId is optional
    if (!projectId && !tag) {
      return new Response(
        `data: ${JSON.stringify({ error: 'Either projectId or tag is required' })}\n\n`,
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        }
      );
    }

    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    const subscriptionTimestamp = new Date();
    const filterDesc = tag
      ? `tag=${tag}`
      : `project ${projectId}${sessionId ? `, session ${sessionId}` : ''}`;
    console.log(`[hook-events/stream] Starting stream for ${filterDesc}`);

    const encoder = new TextEncoder();

    let isCancelled = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection confirmation
          controller.enqueue(encoder.encode(`: connected at ${subscriptionTimestamp.toISOString()}\n\n`));

          // Build WHERE clause for SignalDB stream filtering
          // AC-004: Tag takes precedence over projectId
          let whereClause: string;
          if (tag) {
            // For tag filtering, fetch all events for the project and filter in-memory
            whereClause = projectId ? `project_id='${projectId}'` : '1=1';
          } else if (sessionId) {
            whereClause = `project_id='${projectId}' AND session_id='${sessionId}'`;
          } else {
            whereClause = `project_id='${projectId}'`;
          }

          const signalStream = createSignalDBStream({
            table: 'hook_events',
            where: whereClause,
            subscriptionTimestamp,
          });

          console.log('[hook-events/stream] Connected to SignalDB stream for', whereClause);

          for await (const sseMessage of signalStream.stream()) {
            if (isCancelled) break;

            // Parse the SSE data for tag filtering
            const dataMatch = sseMessage.match(/^data: (.+)\n\n$/);
            if (!dataMatch) continue;

            const row = JSON.parse(dataMatch[1]);

            // AC-002, AC-004, AC-006: Filter by tag if specified (tag takes precedence)
            if (tag) {
              const eventTags = row.tags || [];
              if (!eventTags.includes(tag)) {
                console.log(`[hook-events/stream] Skipping event - tag '${tag}' not in`, eventTags);
                continue;
              }
            }

            console.log('[hook-events/stream] Sending event:', row.id);
            controller.enqueue(encoder.encode(sseMessage));
          }

          console.log('[hook-events/stream] Stream ended gracefully');
        } catch (error) {
          if (!isCancelled) {
            console.error('[hook-events/stream] Error:', error);
            try {
              const errorMessage = `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
              controller.enqueue(encoder.encode(errorMessage));
            } catch (e) {
              // Controller already closed, ignore
            }
          }
        } finally {
          if (!isCancelled) {
            try {
              controller.close();
            } catch (e) {
              // Already closed, ignore
            }
          }
        }
      },
      cancel() {
        console.log('[hook-events/stream] Client disconnected');
        isCancelled = true;
      }
    });

    return new Response(stream);
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Project ID to filter hook events' })),
      sessionId: t.Optional(t.String({ description: 'Optional session ID to filter hook events' })),
      tag: t.Optional(t.String({ description: 'Tag to filter hook events (takes precedence over projectId)' })),
    }),
  });
