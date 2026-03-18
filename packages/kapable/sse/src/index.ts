/**
 * @kapable/sse — Server-Sent Events via pg_notify for Kapable apps.
 *
 * Usage:
 *   import { getDB } from '@kapable/db';
 *   import { createSSEStream } from '@kapable/sse';
 *   const sql = getDB();
 *   const stream = await createSSEStream(sql, 'room_updates');
 */

import type postgres from 'postgres';

export interface SSEOptions {
  heartbeatMs?: number;
  transform?: (payload: string) => string | null;
}

export async function createSSEStream(
  sql: ReturnType<typeof postgres>,
  channel: string,
  options: SSEOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const { heartbeatMs = 30000, transform } = options;
  const encoder = new TextEncoder();

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => Promise<void>) | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const sub = await sql.listen(channel, (payload) => {
        try {
          const data = transform ? transform(payload) : payload;
          if (data !== null) {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch (err) {
          console.error(`[sse] Error processing payload on ${channel}:`, err);
        }
      });

      unsubscribe = async () => {
        try { await sub.unlisten(); } catch { /* already closed */ }
      };

      controller.enqueue(encoder.encode(`event: connected\ndata: {"channel":"${channel}"}\n\n`));

      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, heartbeatMs);
    },

    async cancel() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (unsubscribe) {
        await unsubscribe();
        unsubscribe = null;
      }
    },
  });
}
