/**
 * Audio Generation SSE Stream
 * Real-time notifications when audio generation completes via SignalDB table streaming.
 *
 * Replaces the previous PostgreSQL LISTEN/NOTIFY approach.
 * SignalDB automatically triggers NOTIFY on audio_cache table inserts,
 * so the worker no longer needs explicit pg_notify calls.
 */

import { Elysia, t } from 'elysia';
import { createSignalDBStream } from '../../lib/signaldb-stream';

export const audioStreamRoutes = new Elysia({ prefix: '/stream/audio' })
  .get(
    '/',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const { messageIds } = query;

      if (!messageIds) {
        set.status = 400;
        yield `data: ${JSON.stringify({ error: 'messageIds query parameter is required (comma-separated)' })}\n\n`;
        return;
      }

      // Parse comma-separated messageIds
      const messageIdList = messageIds.split(',').map(id => id.trim()).filter(id => id.length > 0);

      if (messageIdList.length === 0) {
        set.status = 400;
        yield `data: ${JSON.stringify({ error: 'At least one messageId is required' })}\n\n`;
        return;
      }

      const subscriptionTimestamp = new Date();

      console.log(`[audio/stream] Starting audio stream for messages:`, messageIdList);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream audio_cache table changes via SignalDB
        // Filter by hook_event_id IN (messageIds)
        const idList = messageIdList.map(id => `'${id}'`).join(',');
        const stream = createSignalDBStream({
          table: 'audio_cache',
          where: `hook_event_id IN (${idList})`,
          subscriptionTimestamp,
        });

        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        heartbeatTimer = setInterval(() => {
          // Heartbeat — SignalDB streams have their own keepalive
        }, 30000);

        try {
          for await (const sseMessage of stream.stream()) {
            // Parse and re-format as the event shape clients expect
            try {
              const dataMatch = sseMessage.match(/^data: (.+)\n\n$/);
              if (dataMatch) {
                const row = JSON.parse(dataMatch[1]);

                const event = {
                  type: 'generation_complete',
                  messageId: row.hookEventId,
                  audioUrl: row.url || row.audioUrl,
                  voiceId: row.voiceId,
                  role: row.role,
                  generatedAt: row.createdAt || new Date().toISOString(),
                };

                console.log('[audio/stream] Audio generated:', {
                  messageId: event.messageId,
                  audioUrl: event.audioUrl,
                  role: event.role,
                });

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
        console.error('[audio/stream] Error:', error);
        yield `data: ${JSON.stringify({
          error: 'Stream error',
          message: String(error)
        })}\n\n`;
      }
    },
    {
      query: t.Object({
        messageIds: t.String({ description: 'Comma-separated list of message IDs (hook event IDs) to monitor' }),
      }),
      detail: {
        tags: ['Audio', 'Streaming'],
        summary: 'Stream audio generation updates',
        description: 'Real-time SSE stream of audio generation completion events via SignalDB table streaming. Filters events by provided message IDs.',
      },
    }
  );
