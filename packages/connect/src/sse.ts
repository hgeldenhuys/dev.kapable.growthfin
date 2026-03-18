/**
 * Connect SDK — SSE (Server-Sent Events)
 *
 * Creates a ReadableStream backed by pg_notify for real-time updates.
 * Includes automatic heartbeats and clean resource cleanup.
 *
 * Usage:
 *   import { getDB } from '@signaldb-live/connect/db';
 *   import { createSSEStream } from '@signaldb-live/connect/sse';
 *
 *   // In a route handler:
 *   export async function loader({ request }: LoaderFunctionArgs) {
 *     const sql = getDB();
 *     const stream = await createSSEStream(sql, 'room_updates', {
 *       heartbeatMs: 15000,
 *       transform: (payload) => payload, // optional
 *     });
 *     return new Response(stream, {
 *       headers: {
 *         'Content-Type': 'text/event-stream',
 *         'Cache-Control': 'no-cache',
 *         'Connection': 'keep-alive',
 *       },
 *     });
 *   }
 */

import type postgres from 'postgres';
import type { SSEOptions } from './types';

/**
 * Create an SSE ReadableStream from a pg_notify channel.
 * Automatically sends heartbeats and cleans up the LISTEN on cancel.
 */
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
      // Subscribe to pg_notify channel
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

      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: {"channel":"${channel}"}\n\n`));

      // Heartbeat to prevent proxy/load-balancer timeouts
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Stream already closed
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
