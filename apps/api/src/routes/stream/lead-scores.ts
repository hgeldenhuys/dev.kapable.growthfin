/**
 * Lead Score SSE Stream
 * Real-time notifications when lead propensity scores change via SignalDB table streaming.
 *
 * Replaces the previous PostgreSQL LISTEN/NOTIFY approach.
 * SignalDB automatically triggers NOTIFY on crm_leads table updates,
 * so the worker no longer needs explicit pg_notify calls.
 */

import { Elysia, t } from 'elysia';
import { createSignalDBStream } from '../../lib/signaldb-stream';

export const leadScoresStreamRoutes = new Elysia({ prefix: '/stream/crm/leads' })
  .get(
    '/scores',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const { workspaceId, userId, leadIds } = query;
      const subscriptionTimestamp = new Date();

      console.log(`[lead-scores/stream] Starting score stream for workspace ${workspaceId}`, {
        userId,
        leadIdsCount: leadIds ? leadIds.split(',').length : 'all',
      });

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Build WHERE clause for crm_leads table
        let where = `workspace_id='${workspaceId}'`;

        if (userId) {
          where += ` AND owner_id='${userId}'`;
        }

        if (leadIds) {
          const idList = leadIds.split(',').map(id => `'${id.trim()}'`).join(',');
          where += ` AND id IN (${idList})`;
        }

        // Stream crm_leads table changes via SignalDB
        // SignalDB auto-triggers on UPDATE, so propensity_score changes are captured
        const stream = createSignalDBStream({
          table: 'crm_leads',
          where,
          columns: ['id', 'workspace_id', 'owner_id', 'propensity_score', 'propensity_score_updated_at', 'score_breakdown', 'updated_at'],
          subscriptionTimestamp,
        });

        // Set up heartbeat (SignalDB streams may have their own keepalive,
        // but we add our own for compatibility with existing clients)
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        const heartbeatQueue: string[] = [];
        let resolveHeartbeat: ((value: string) => void) | null = null;

        heartbeatTimer = setInterval(() => {
          const heartbeat = `: heartbeat at ${new Date().toISOString()}\n\n`;
          if (resolveHeartbeat) {
            resolveHeartbeat(heartbeat);
            resolveHeartbeat = null;
          } else {
            heartbeatQueue.push(heartbeat);
          }
        }, 30000);

        try {
          for await (const sseMessage of stream.stream()) {
            // Parse the SSE data to extract score info for the event format
            try {
              const dataMatch = sseMessage.match(/^data: (.+)\n\n$/);
              if (dataMatch) {
                const row = JSON.parse(dataMatch[1]);

                // Format as the same event shape clients expect
                const event = {
                  type: 'score_changed',
                  leadId: row.id,
                  workspaceId: row.workspaceId,
                  scoreAfter: row.propensityScore,
                  scoreBreakdown: row.scoreBreakdown,
                  updatedAt: row.propensityScoreUpdatedAt || row.updatedAt,
                };

                yield `data: ${JSON.stringify(event)}\n\n`;
              }
            } catch {
              // Pass through raw SSE if parsing fails
              yield sseMessage;
            }
          }
        } finally {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      } catch (error) {
        console.error('[lead-scores/stream] Error:', error);
        yield `data: ${JSON.stringify({
          error: 'Stream error',
          message: String(error)
        })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.Optional(t.String()),
        leadIds: t.Optional(t.String()), // Comma-separated lead IDs
      }),
      detail: {
        tags: ['Lead Scores', 'Streaming'],
        summary: 'Stream lead score updates',
        description: 'Real-time SSE stream of lead propensity score changes via SignalDB table streaming. Supports filtering by workspace, user, and specific lead IDs.',
      },
    }
  );
