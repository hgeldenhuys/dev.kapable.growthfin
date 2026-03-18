/**
 * Lead Queue Routes
 * Sales rep queue management endpoints with real-time SSE streaming
 * Story: US-SALES-QUEUE-001
 */

import { Elysia, t } from 'elysia';
import { queueService } from '../services/queue.service';
import { streamLeads } from '../../../lib/electric-shapes';

export const queueRoutes = new Elysia({ prefix: '/leads/queue' })
  /**
   * GET /my-queue - Get personal lead queue
   * Returns prioritized list of assigned leads with stats
   */
  .get(
    '/my-queue',
    async ({ db, query }) => {
      const limit = query.limit ? Math.min(100, Math.max(1, parseInt(query.limit, 10))) : 50;
      const offset = query.offset ? Math.max(0, parseInt(query.offset, 10)) : 0;

      const result = await queueService.getMyQueue(db, {
        workspaceId: query.workspaceId,
        userId: query.userId,
        limit,
        offset,
      });

      // Get available leads count for claiming
      const availableCount = await queueService.getAvailableLeadsCount(
        db,
        query.workspaceId
      );

      return {
        leads: result.leads,
        stats: {
          ...result.stats,
          availableToClaimCount: availableCount,
        },
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + limit < result.total,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Queue'],
        summary: 'Get personal lead queue',
        description:
          'Get prioritized queue of assigned leads. Priority: 1) Overdue callbacks 2) Future callbacks 3) High propensity scores 4) FIFO. Includes queue stats and available leads count.',
      },
    }
  )

  /**
   * GET /my-queue/stream - SSE stream for queue updates
   * Real-time updates when leads are assigned/claimed/removed
   */
  .get(
    '/my-queue/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(
        `[queue/my-queue/stream] Starting stream for user ${query.userId} in workspace ${query.workspaceId}`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream lead changes for this workspace
        // Filter on client side for owner_id = userId
        const electric = streamLeads(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          // Parse the SSE message to filter for this user's leads
          const lines = sseMessage.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.substring(6);
            }
          }

          if (eventData) {
            try {
              const data = JSON.parse(eventData);

              // Only send updates for this user's leads or unassigned leads
              if (
                data.value &&
                (data.value.owner_id === query.userId || data.value.owner_id === null)
              ) {
                // Determine event type based on changes
                let queueEventType = 'lead_updated';
                if (data.value.owner_id === query.userId && data.value.status === 'new') {
                  queueEventType = 'lead_assigned';
                } else if (data.value.owner_id === null) {
                  queueEventType = 'lead_available';
                }

                // Send filtered event
                yield `event: ${queueEventType}\ndata: ${JSON.stringify({
                  type: queueEventType,
                  lead: data.value,
                  timestamp: new Date().toISOString(),
                })}\n\n`;
              }
            } catch (parseError) {
              console.error('[queue/stream] Failed to parse event data:', parseError);
            }
          }
        }
      } catch (error) {
        console.error('[queue/my-queue/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      detail: {
        tags: ['Queue'],
        summary: 'Stream queue updates',
        description:
          'Real-time SSE stream of lead assignments and changes. Events: lead_assigned, lead_updated, lead_available. NO POLLING - reactive updates only.',
      },
    }
  )

  /**
   * POST /claim-next - Claim next available lead
   * Atomic operation with optimistic locking
   */
  .post(
    '/claim-next',
    async ({ db, body, set }) => {
      const result = await queueService.claimNextLead(db, {
        workspaceId: body.workspaceId,
        userId: body.userId,
        maxPropensityScore: body.maxPropensityScore,
        excludeTags: body.excludeTags,
      });

      if (!result.success) {
        // Not an error - just no leads available
        set.status = 200;
        return {
          success: false,
          message: result.message || 'No leads available to claim',
        };
      }

      return {
        success: true,
        lead: result.lead,
        claimedAt: new Date().toISOString(),
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        maxPropensityScore: t.Optional(t.Number()),
        excludeTags: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ['Queue'],
        summary: 'Claim next available lead',
        description:
          'Atomically claim the next unassigned lead. Uses FOR UPDATE SKIP LOCKED to prevent race conditions. Returns claimed lead or message if none available.',
      },
    }
  )

  /**
   * GET /available-count - Get count of claimable leads
   */
  .get(
    '/available-count',
    async ({ db, query }) => {
      const count = await queueService.getAvailableLeadsCount(db, query.workspaceId);

      return {
        availableCount: count,
        workspaceId: query.workspaceId,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Queue'],
        summary: 'Get available leads count',
        description: 'Get count of unassigned leads available to claim in workspace.',
      },
    }
  );
