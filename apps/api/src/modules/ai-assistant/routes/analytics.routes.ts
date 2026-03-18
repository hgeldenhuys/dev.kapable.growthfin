/**
 * AI Analytics Routes
 * Endpoints for AI assistant analytics and observability
 */

import { Elysia, t } from 'elysia';
import { Pool } from 'pg';
import {
  AnalyticsService,
  CostCalculatorService,
  PerformanceMetricsService,
  SessionAuditService,
} from '../services/analytics';

// PostgreSQL connection pool for SSE streaming
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const analyticsRoutes = new Elysia({ prefix: '/workspaces/:workspaceId/ai/analytics' })
  /**
   * GET /workspaces/:workspaceId/ai/analytics/tools
   * Get tool usage statistics
   */
  .get(
    '/tools',
    async ({ params, query }) => {
      const { workspaceId } = params;
      const { startDate, endDate, toolName } = query;

      const dateRange =
        startDate && endDate
          ? {
              startDate: new Date(startDate),
              endDate: new Date(endDate),
            }
          : undefined;

      const stats = await AnalyticsService.getToolUsageStats(workspaceId, dateRange);

      // If toolName filter provided, filter results
      const filteredStats = toolName ? stats.filter((s) => s.toolName === toolName) : stats;

      return {
        workspaceId,
        dateRange: dateRange
          ? {
              startDate: dateRange.startDate.toISOString(),
              endDate: dateRange.endDate.toISOString(),
            }
          : null,
        stats: filteredStats,
      };
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        toolName: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Analytics'],
        summary: 'Get tool usage statistics',
        description: 'Get aggregated statistics for AI tool invocations',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/analytics/tools/timeseries
   * Get tool usage time-series data
   */
  .get(
    '/tools/timeseries',
    async ({ params, query }) => {
      const { workspaceId } = params;
      const { startDate, endDate, toolName } = query;

      const dateRange =
        startDate && endDate
          ? {
              startDate: new Date(startDate),
              endDate: new Date(endDate),
            }
          : undefined;

      const timeSeries = await AnalyticsService.getToolUsageTimeSeries(
        workspaceId,
        dateRange,
        toolName
      );

      return {
        workspaceId,
        dateRange: dateRange
          ? {
              startDate: dateRange.startDate.toISOString(),
              endDate: dateRange.endDate.toISOString(),
            }
          : null,
        timeSeries,
      };
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        toolName: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Analytics'],
        summary: 'Get tool usage time-series data',
        description: 'Get daily time-series data for tool usage charting',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/analytics/costs
   * Get cost breakdown
   */
  .get(
    '/costs',
    async ({ params, query }) => {
      const { workspaceId } = params;
      const { startDate, endDate, groupBy } = query;

      const dateRange =
        startDate && endDate
          ? {
              startDate: new Date(startDate),
              endDate: new Date(endDate),
            }
          : undefined;

      const costs = await CostCalculatorService.calculateCosts(
        workspaceId,
        dateRange,
        (groupBy as 'day' | 'week' | 'month') || 'day'
      );

      const totalCost = await CostCalculatorService.getTotalCost(workspaceId, dateRange);

      return {
        workspaceId,
        dateRange: dateRange
          ? {
              startDate: dateRange.startDate.toISOString(),
              endDate: dateRange.endDate.toISOString(),
            }
          : null,
        groupBy: groupBy || 'day',
        summary: totalCost,
        breakdown: costs,
      };
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        groupBy: t.Optional(t.Union([t.Literal('day'), t.Literal('week'), t.Literal('month')])),
      }),
      detail: {
        tags: ['AI Analytics'],
        summary: 'Get cost breakdown',
        description: 'Get token cost breakdown by date and model',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/analytics/performance
   * Get performance metrics
   */
  .get(
    '/performance',
    async ({ params, query }) => {
      const { workspaceId } = params;
      const { startDate, endDate, toolName } = query;

      const dateRange =
        startDate && endDate
          ? {
              startDate: new Date(startDate),
              endDate: new Date(endDate),
            }
          : undefined;

      const metrics = await PerformanceMetricsService.getMetrics(
        workspaceId,
        toolName,
        dateRange
      );

      return {
        workspaceId,
        dateRange: dateRange
          ? {
              startDate: dateRange.startDate.toISOString(),
              endDate: dateRange.endDate.toISOString(),
            }
          : null,
        metrics,
      };
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        toolName: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Analytics'],
        summary: 'Get performance metrics',
        description: 'Get latency percentiles and error rates for tool invocations',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/analytics/sessions
   * Get Claude Code session audit log
   */
  .get(
    '/sessions',
    async ({ params, query }) => {
      const { workspaceId } = params;
      const { startDate, endDate, status, limit, offset } = query;

      const filters = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status as 'active' | 'completed' | 'error' | undefined,
      };

      const pagination = {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      };

      const result = await SessionAuditService.getSessions(workspaceId, filters, pagination);

      return {
        workspaceId,
        filters: {
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          status: filters.status,
        },
        pagination,
        total: result.total,
        sessions: result.sessions,
      };
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        status: t.Optional(t.Union([t.Literal('active'), t.Literal('completed'), t.Literal('error')])),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Analytics'],
        summary: 'Get session audit log',
        description: 'Get Claude Code session history with filtering and pagination',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/analytics/sessions/:sessionId
   * Get session details by ID
   */
  .get(
    '/sessions/:sessionId',
    async ({ params }) => {
      const { workspaceId, sessionId } = params;

      const session = await SessionAuditService.getSessionById(workspaceId, sessionId);

      if (!session) {
        return {
          error: 'Session not found',
          statusCode: 404,
        };
      }

      return {
        workspaceId,
        session,
      };
    },
    {
      detail: {
        tags: ['AI Analytics'],
        summary: 'Get session details',
        description: 'Get detailed information about a specific Claude Code session',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/analytics/stream
   * Real-time activity stream via SSE
   */
  .get(
    '/stream',
    async function* ({ params, set }) {
      const { workspaceId } = params;

      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[analytics/stream] Starting stream for workspace ${workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      // Get a dedicated PostgreSQL connection for LISTEN
      const client = await pool.connect();

      try {
        // Listen for tool invocation updates
        await client.query('LISTEN ai_tool_invocations_channel');

        console.log('[analytics/stream] Listening for ai_tool_invocations_channel notifications');

        // Create async iterator for notifications
        const notificationQueue: any[] = [];
        let resolveNext: ((value: any) => void) | null = null;

        client.on('notification', (msg) => {
          if (msg.channel === 'ai_tool_invocations_channel') {
            const payload = JSON.parse(msg.payload || '{}');

            // Filter by workspace
            if (payload.workspace_id !== workspaceId) {
              return;
            }

            console.log('[analytics/stream] Tool invocation:', {
              toolName: payload.tool_name,
              status: payload.status,
              durationMs: payload.duration_ms,
            });

            // Format SSE event
            const event = {
              type: 'tool_invocation',
              data: {
                id: payload.id,
                toolName: payload.tool_name,
                status: payload.status,
                duration: payload.duration_ms,
                timestamp: payload.created_at,
              },
              timestamp: new Date().toISOString(),
            };

            const sseMessage = `data: ${JSON.stringify(event)}\n\n`;

            if (resolveNext) {
              resolveNext(sseMessage);
              resolveNext = null;
            } else {
              notificationQueue.push(sseMessage);
            }
          }
        });

        // Keep-alive heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          const heartbeat = `: heartbeat at ${new Date().toISOString()}\n\n`;
          if (resolveNext) {
            resolveNext(heartbeat);
            resolveNext = null;
          } else {
            notificationQueue.push(heartbeat);
          }
        }, 30000);

        // Stream notifications
        try {
          while (true) {
            if (notificationQueue.length > 0) {
              yield notificationQueue.shift();
            } else {
              // Wait for next notification
              yield await new Promise<string>((resolve) => {
                resolveNext = resolve;
              });
            }
          }
        } finally {
          clearInterval(heartbeatInterval);
        }
      } catch (error) {
        console.error('[analytics/stream] Error:', error);
        yield `data: ${JSON.stringify({
          error: 'Stream error',
          message: String(error),
        })}\n\n`;
      } finally {
        // Cleanup
        try {
          await client.query('UNLISTEN ai_tool_invocations_channel');
        } catch (e) {
          console.error('[analytics/stream] Error unlistening:', e);
        }
        client.release();
        console.log('[analytics/stream] Connection closed');
      }
    },
    {
      detail: {
        tags: ['AI Analytics'],
        summary: 'Real-time activity stream',
        description: 'Stream real-time AI tool invocations via SSE using PostgreSQL NOTIFY',
      },
    }
  );
