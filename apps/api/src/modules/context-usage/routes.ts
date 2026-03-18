/**
 * Context Usage Routes
 * HTTP routes for context usage tracking
 *
 * Implements CQRS pattern:
 * - GET /recent - Initial state (last N days)
 * - GET /stream - SSE streaming for real-time updates
 *
 * Data source: hook_events table (Stop events with usage data)
 * Service: Uses contextUsageService from ./service.ts
 */

import { Elysia, t } from 'elysia';
import { contextUsageService } from './service';
import { createSignalDBStream } from '../../lib/signaldb-stream';
import type { TimeRange } from './types';

// Context limit constant (200k tokens)
const CONTEXT_LIMIT = 200000;

/**
 * Calculate alert based on percentage used
 */
function getAlert(percentageUsed: number) {
  if (percentageUsed >= 90) {
    return {
      level: 'critical' as const,
      message: `Context usage at ${percentageUsed.toFixed(1)}% - approaching limit!`,
    };
  } else if (percentageUsed >= 75) {
    return {
      level: 'warning' as const,
      message: `Context usage at ${percentageUsed.toFixed(1)}% of 200k limit`,
    };
  }
  return undefined;
}

export const contextUsageRoutes = new Elysia()
  /**
   * GET /recent - Get recent context usage sessions
   *
   * Returns session-level usage metrics aggregated from Stop events.
   * Used for initial state in CQRS pattern.
   *
   * Query parameters:
   * - projectId (optional): Filter by project
   * - timeRange (optional): '1h' | '24h' | '7d' | '30d' (default: '7d')
   *
   * Response format:
   * {
   *   sessions: ContextUsageMetrics[],
   *   summary: ContextUsageSummary
   * }
   */
  .get('/recent', async ({ db, query }) => {
    // Parse query parameters
    const projectId = query.projectId;
    const timeRange = (query.timeRange as TimeRange) || '8h';
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
      // Fetch sessions and summary in parallel
      const [sessions, summary] = await Promise.all([
        contextUsageService.getRecent(db, { projectId, timeRange, limit }),
        contextUsageService.getSummary(db, { projectId, timeRange }),
      ]);

      return {
        sessions,
        summary,
      };
    } catch (error) {
      console.error('[context-usage/recent] Error:', error);
      throw error;
    }
  }, {
    query: t.Object({
      projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
      timeRange: t.Optional(t.String({
        description: 'Time range for usage data',
        examples: ['1h', '8h', '24h', '7d', '30d'],
        default: '8h'
      })),
      limit: t.Optional(t.String({
        description: 'Maximum number of sessions to return',
        examples: ['5', '10', '20'],
      })),
    }),
    detail: {
      tags: ['Context Usage'],
      summary: 'Get recent context usage sessions',
      description: 'Fetch context usage metrics aggregated by session from Stop events. Returns session-level token usage and summary statistics.',
    },
  })
  /**
   * GET /:sessionId - Get context usage for specific session
   *
   * Returns usage metrics for a single session.
   *
   * Query parameters:
   * - projectId (required): Project ID
   */
  .get('/:sessionId', async ({ db, params, query, set }) => {
    const { sessionId } = params;
    const projectId = query.projectId;

    if (!projectId) {
      set.status = 400;
      return {
        error: 'Missing required parameter',
        message: 'projectId is required',
      };
    }

    try {
      const session = await contextUsageService.getBySessionId(db, sessionId, projectId);

      if (!session) {
        set.status = 404;
        return {
          error: 'Session not found',
          message: `No context usage found for session ${sessionId}`,
        };
      }

      return session;
    } catch (error) {
      console.error('[context-usage/:sessionId] Error:', error);
      throw error;
    }
  }, {
    params: t.Object({
      sessionId: t.String({ description: 'Session ID' }),
    }),
    query: t.Object({
      projectId: t.String({ description: 'Project ID (required)' }),
    }),
    detail: {
      tags: ['Context Usage'],
      summary: 'Get context usage for specific session',
      description: 'Fetch context usage metrics for a single session ID.',
    },
  })
  /**
   * GET /stream - Stream context usage updates via SSE
   *
   * Listens for new Stop events from hook_events and calculates context metrics.
   * Emits context_update events with alert warnings when thresholds are exceeded.
   *
   * Uses SignalDB for instant event delivery via native SSE (NO POLLING).
   *
   * Query parameters:
   * - projectId (required): Filter by project
   */
  .get('/stream', async ({ query, set }) => {
    const projectId = query.projectId;

    if (!projectId) {
      return new Response(
        `data: ${JSON.stringify({ error: 'projectId is required' })}\n\n`,
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
    console.log(`[context-usage/stream] Starting stream for project ${projectId}`);

    const encoder = new TextEncoder();
    let isCancelled = false;

    const whereClause = `project_id='${projectId}' AND event_name='Stop'`;
    const signalStream = createSignalDBStream({
      table: 'hook_events',
      where: whereClause,
      subscriptionTimestamp,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection confirmation
          controller.enqueue(encoder.encode(`: connected at ${subscriptionTimestamp.toISOString()}\n\n`));

          console.log('[context-usage/stream] Starting SignalDB stream for hook_events');

          for await (const sseMessage of signalStream.stream()) {
            if (isCancelled) break;

            // Parse the SSE data (SignalDB adapter yields "data: {...}\n\n")
            const dataMatch = sseMessage.match(/^data: (.+)\n\n$/);
            if (!dataMatch) continue;

            let row: Record<string, any>;
            try {
              row = JSON.parse(dataMatch[1]);
            } catch {
              continue;
            }

            // Extract session ID from event (camelCase from SignalDB adapter)
            const sessionId = row.sessionId;
            if (!sessionId) {
              console.log('[context-usage/stream] Skipping event without sessionId');
              continue;
            }

            console.log('[context-usage/stream] Processing Stop event for session:', sessionId);

            // Extract usage from the event payload
            const payload = row.payload;
            const usage = payload?.conversation?.message?.usage;

            if (!usage) {
              console.log('[context-usage/stream] No usage data in event');
              continue;
            }

            const inputTokens = usage.input_tokens || 0;
            const outputTokens = usage.output_tokens || 0;
            const cachedTokens = usage.cache_read_input_tokens || 0;
            const totalTokens = inputTokens + outputTokens + cachedTokens;
            const percentageUsed = (totalTokens / CONTEXT_LIMIT) * 100;

            // Check alert thresholds
            const alert = getAlert(percentageUsed);

            // Build context_update event
            const updateEvent = {
              type: 'context_update',
              data: {
                sessionId,
                projectId,
                metrics: {
                  inputTokens,
                  outputTokens,
                  cachedTokens,
                  totalTokens,
                  percentageUsed: Math.round(percentageUsed * 100) / 100,
                },
                alert,
              },
            };

            // Send event to client
            const outMessage = `event: context_update\ndata: ${JSON.stringify(updateEvent)}\n\n`;
            console.log('[context-usage/stream] Sending context_update for session:', sessionId);
            controller.enqueue(encoder.encode(outMessage));
            console.log('[context-usage/stream] Event sent successfully');
          }

          console.log('[context-usage/stream] Stream ended gracefully');
        } catch (error) {
          if (!isCancelled) {
            console.error('[context-usage/stream] Error:', error);
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
        console.log('[context-usage/stream] Client disconnected');
        isCancelled = true;
        signalStream.abort();
      },
    });

    return new Response(stream);
  }, {
    query: t.Object({
      projectId: t.String({ description: 'Project ID to filter context usage events' }),
    }),
    detail: {
      tags: ['Context Usage'],
      summary: 'Stream context usage updates',
      description: 'Stream real-time context usage updates via SSE when new Stop events occur. Uses SignalDB for instant delivery via native SSE (NO POLLING). Includes alert warnings at 75% and 90% thresholds.',
    },
  });
