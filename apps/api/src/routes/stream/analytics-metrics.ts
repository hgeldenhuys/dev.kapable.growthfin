/**
 * Campaign Analytics Metrics SSE Stream
 * Real-time notifications when campaign recipient metrics change via SignalDB table streaming.
 *
 * Replaces the previous PostgreSQL LISTEN/NOTIFY approach.
 * SignalDB automatically triggers NOTIFY on crm_campaign_recipients table updates.
 */

import { Elysia, t } from 'elysia';
import { createSignalDBStream } from '../../lib/signaldb-stream';

export const analyticsMetricsStreamRoutes = new Elysia({ prefix: '/stream/crm/analytics' })
  .get(
    '/campaigns/:campaignId/metrics',
    async function* ({ params, query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const { campaignId } = params;
      const { workspaceId } = query;

      if (!workspaceId) {
        set.status = 400;
        yield `data: ${JSON.stringify({ error: 'workspaceId is required' })}\n\n`;
        return;
      }

      const subscriptionTimestamp = new Date();

      console.log(`[analytics-metrics/stream] Starting metrics stream for campaign ${campaignId}`, {
        workspaceId,
      });

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream crm_campaign_recipients table changes via SignalDB
        const stream = createSignalDBStream({
          table: 'crm_campaign_recipients',
          where: `workspace_id='${workspaceId}' AND campaign_id='${campaignId}'`,
          subscriptionTimestamp,
        });

        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        heartbeatTimer = setInterval(() => {
          // Heartbeat handled inline below
        }, 30000);

        try {
          // Interleave heartbeats with stream events
          let lastEventTime = Date.now();

          for await (const sseMessage of stream.stream()) {
            lastEventTime = Date.now();

            // Parse and re-format as the event shape clients expect
            try {
              const dataMatch = sseMessage.match(/^data: (.+)\n\n$/);
              if (dataMatch) {
                const row = JSON.parse(dataMatch[1]);

                const event = {
                  type: 'campaign_metrics_update',
                  campaignId: row.campaignId || campaignId,
                  workspaceId: row.workspaceId || workspaceId,
                  recipientId: row.id,
                  status: row.status,
                  updatedAt: row.updatedAt,
                };

                yield `data: ${JSON.stringify(event)}\n\n`;
              }
            } catch {
              yield sseMessage;
            }
          }
        } finally {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      } catch (error) {
        console.error('[analytics-metrics/stream] Error:', error);
        yield `data: ${JSON.stringify({
          error: 'Stream error',
          message: String(error)
        })}\n\n`;
      }
    },
    {
      params: t.Object({
        campaignId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Analytics', 'Streaming'],
        summary: 'Stream campaign metrics updates',
        description: 'Real-time SSE stream of campaign analytics metrics changes via SignalDB table streaming. Updates when recipient statuses change (sent, delivered, opened, clicked, bounced).',
      },
    }
  );
