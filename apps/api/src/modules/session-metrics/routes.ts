/**
 * Session Metrics Routes
 * US-001: Add session metrics dashboard
 *
 * HTTP routes for session metrics API
 * Implements CQRS pattern:
 * - GET /sessions - List sessions with metrics
 * - GET /aggregate - Aggregated metrics summary
 * - GET /tools - Tool usage statistics
 * - GET /duration - Duration analytics
 * - GET /stream - SSE streaming for real-time updates
 */

import { Elysia, t } from 'elysia';
import { sessionMetricsService } from './service';
import { createSignalDBStream } from '../../lib/signaldb-stream';
import type { TimeRange } from './types';

export const sessionMetricsRoutes = new Elysia()
  /**
   * GET /sessions - List sessions with metrics
   *
   * Returns session-level metrics computed from hook_events.
   *
   * Query parameters:
   * - projectId (optional): Filter by project
   * - agentType (optional): Filter by agent type
   * - timeRange (optional): '1h' | '8h' | '24h' | '7d' | '30d' (default: '7d')
   * - limit (optional): Maximum sessions to return
   */
  .get('/sessions', async ({ db, query }) => {
    const projectId = query.projectId;
    const agentType = query.agentType;
    const timeRange = (query.timeRange as TimeRange) || '7d';
    const limit = query.limit ? parseInt(query.limit) : undefined;

    // Validate timeRange
    const validRanges: TimeRange[] = ['1h', '8h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return {
        error: 'Invalid timeRange parameter',
        message: `timeRange must be one of: ${validRanges.join(', ')}`,
      };
    }

    try {
      const sessions = await sessionMetricsService.getSessions(db, {
        projectId,
        agentType,
        timeRange,
        limit,
      });

      return { sessions };
    } catch (error) {
      console.error('[session-metrics/sessions] Error:', error);
      throw error;
    }
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
      agentType: t.Optional(t.String({ description: 'Filter by agent type' })),
      timeRange: t.Optional(t.String({
        description: 'Time range for metrics',
        examples: ['1h', '8h', '24h', '7d', '30d'],
        default: '7d',
      })),
      limit: t.Optional(t.String({
        description: 'Maximum sessions to return',
        examples: ['5', '10', '20'],
      })),
    }),
    detail: {
      tags: ['Session Metrics'],
      summary: 'List sessions with metrics',
      description: 'Fetch session-level metrics computed from hook_events. Returns session duration, event count, tool usage, and todo stats.',
    },
  })

  /**
   * GET /aggregate - Aggregated metrics summary
   *
   * Returns aggregated metrics across all sessions.
   *
   * Query parameters:
   * - projectId (optional): Filter by project
   * - timeRange (optional): '1h' | '8h' | '24h' | '7d' | '30d' (default: '7d')
   */
  .get('/aggregate', async ({ db, query }) => {
    const projectId = query.projectId;
    const timeRange = (query.timeRange as TimeRange) || '7d';

    // Validate timeRange
    const validRanges: TimeRange[] = ['1h', '8h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return {
        error: 'Invalid timeRange parameter',
        message: `timeRange must be one of: ${validRanges.join(', ')}`,
      };
    }

    try {
      const aggregate = await sessionMetricsService.getAggregate(db, {
        projectId,
        timeRange,
      });

      return aggregate;
    } catch (error) {
      console.error('[session-metrics/aggregate] Error:', error);
      throw error;
    }
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
      timeRange: t.Optional(t.String({
        description: 'Time range for metrics',
        examples: ['1h', '8h', '24h', '7d', '30d'],
        default: '7d',
      })),
    }),
    detail: {
      tags: ['Session Metrics'],
      summary: 'Get aggregated metrics',
      description: 'Fetch aggregated metrics across all sessions. Returns total sessions, active sessions, average duration, top tools, and sessions by agent type.',
    },
  })

  /**
   * GET /tools - Tool usage statistics
   *
   * Returns tool usage statistics across all sessions.
   *
   * Query parameters:
   * - projectId (optional): Filter by project
   * - timeRange (optional): '1h' | '8h' | '24h' | '7d' | '30d' (default: '7d')
   * - limit (optional): Maximum tools to return
   */
  .get('/tools', async ({ db, query }) => {
    const projectId = query.projectId;
    const timeRange = (query.timeRange as TimeRange) || '7d';
    const limit = query.limit ? parseInt(query.limit) : undefined;

    // Validate timeRange
    const validRanges: TimeRange[] = ['1h', '8h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return {
        error: 'Invalid timeRange parameter',
        message: `timeRange must be one of: ${validRanges.join(', ')}`,
      };
    }

    try {
      const tools = await sessionMetricsService.getToolUsageStats(db, {
        projectId,
        timeRange,
        limit,
      });

      return { tools };
    } catch (error) {
      console.error('[session-metrics/tools] Error:', error);
      throw error;
    }
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
      timeRange: t.Optional(t.String({
        description: 'Time range for metrics',
        examples: ['1h', '8h', '24h', '7d', '30d'],
        default: '7d',
      })),
      limit: t.Optional(t.String({
        description: 'Maximum tools to return',
        examples: ['5', '10', '20'],
      })),
    }),
    detail: {
      tags: ['Session Metrics'],
      summary: 'Get tool usage statistics',
      description: 'Fetch tool usage statistics across all sessions. Returns usage count, session count, and average usage per session for each tool.',
    },
  })

  /**
   * GET /duration - Duration analytics
   *
   * Returns duration analytics across all sessions.
   *
   * Query parameters:
   * - projectId (optional): Filter by project
   * - timeRange (optional): '1h' | '8h' | '24h' | '7d' | '30d' (default: '7d')
   */
  .get('/duration', async ({ db, query }) => {
    const projectId = query.projectId;
    const timeRange = (query.timeRange as TimeRange) || '7d';

    // Validate timeRange
    const validRanges: TimeRange[] = ['1h', '8h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return {
        error: 'Invalid timeRange parameter',
        message: `timeRange must be one of: ${validRanges.join(', ')}`,
      };
    }

    try {
      const duration = await sessionMetricsService.getDurationAnalytics(db, {
        projectId,
        timeRange,
      });

      return duration;
    } catch (error) {
      console.error('[session-metrics/duration] Error:', error);
      throw error;
    }
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
      timeRange: t.Optional(t.String({
        description: 'Time range for metrics',
        examples: ['1h', '8h', '24h', '7d', '30d'],
        default: '7d',
      })),
    }),
    detail: {
      tags: ['Session Metrics'],
      summary: 'Get duration analytics',
      description: 'Fetch duration analytics across all sessions. Returns average, median, min, max, total, and p90 duration.',
    },
  })

  /**
   * GET /stream - SSE streaming for real-time updates
   *
   * Listens for new hook_events and sends metrics updates via SSE.
   * Uses SignalDB stream adapter for native SSE delivery (NO POLLING).
   *
   * Query parameters:
   * - projectId (optional): Filter by project
   */
  .get('/stream', async ({ query, set }) => {
    const projectId = query.projectId;

    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    const subscriptionTimestamp = new Date();
    console.log(`[session-metrics/stream] Starting stream${projectId ? ` for project ${projectId}` : ''}`);

    const encoder = new TextEncoder();
    let isCancelled = false;

    const stream = new ReadableStream({
      async start(controller) {
        // Keep a reference so cancel() can abort the SignalDB stream
        let signalStream: ReturnType<typeof createSignalDBStream> | null = null;

        try {
          // Send initial connection confirmation
          controller.enqueue(encoder.encode(`: connected at ${subscriptionTimestamp.toISOString()}\n\n`));

          // Build WHERE clause for session-relevant events
          let whereClause = "event_name IN ('SessionStart', 'SessionResume', 'Stop')";
          if (projectId) {
            whereClause = `project_id='${projectId}' AND ${whereClause}`;
          }

          // Initialize SignalDB stream (replaces ElectricSQL shape streaming)
          signalStream = createSignalDBStream({
            table: 'hook_events',
            where: whereClause,
            subscriptionTimestamp,
          });

          console.log('[session-metrics/stream] SignalDB stream connected for hook_events');

          // Set up 20-second heartbeat
          const heartbeatInterval = setInterval(() => {
            if (!isCancelled) {
              try {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
              } catch (e) {
                clearInterval(heartbeatInterval);
              }
            }
          }, 20000);

          // Stream events from SignalDB (native SSE, no long-polling)
          // SignalDB adapter yields SSE-formatted strings: "data: {...}\n\n"
          // with snake_case already converted to camelCase
          for await (const sseMessage of signalStream.stream()) {
            if (isCancelled) break;

            // Parse the row data from the SSE message
            const dataMatch = sseMessage.match(/^data: (.+)\n\n$/);
            if (!dataMatch) continue;

            let row: Record<string, any>;
            try {
              row = JSON.parse(dataMatch[1]);
            } catch {
              continue;
            }

            // SignalDB adapter already converts to camelCase
            const eventName = row.eventName;
            const sessionId = row.sessionId;

            if (!eventName || !sessionId) continue;

            console.log(`[session-metrics/stream] Processing ${eventName} for session:`, sessionId);

            // Build SSE event (same business logic as before)
            const sseEvent = {
              type: eventName === 'Stop' ? 'session_end' : 'session_start',
              data: {
                sessionId,
                projectId: row.projectId,
                eventName,
                timestamp: row.createdAt,
              },
            };

            const outMessage = `event: metrics_update\ndata: ${JSON.stringify(sseEvent)}\n\n`;
            controller.enqueue(encoder.encode(outMessage));
          }

          clearInterval(heartbeatInterval);
        } catch (error) {
          if (!isCancelled) {
            console.error('[session-metrics/stream] Error:', error);
            try {
              const errorMessage = `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
              controller.enqueue(encoder.encode(errorMessage));
            } catch (e) {
              // Controller already closed
            }
          }
        } finally {
          // Clean up SignalDB connection
          signalStream?.abort();

          if (!isCancelled) {
            try {
              controller.close();
            } catch (e) {
              // Already closed
            }
          }
        }
      },
      cancel() {
        console.log('[session-metrics/stream] Client disconnected');
        isCancelled = true;
      },
    });

    return new Response(stream);
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
    }),
    detail: {
      tags: ['Session Metrics'],
      summary: 'Stream session metrics updates',
      description: 'Stream real-time session metrics updates via SSE. Emits events when sessions start or end. Uses SignalDB for native SSE delivery.',
    },
  });
