/**
 * SSE (Server-Sent Events) handler for backwards compatibility
 *
 * Supports the legacy SSE endpoint: /api/v1/:table/stream
 * Now uses project-scoped channels for data isolation
 */

import type { ApiContext } from './types';
import { subscribeToChanges } from './lib/realtime-sse';
import { trackSseConnect, trackSseDisconnect } from './lib/usage';

interface SSEOptions {
  table: string;
  filters?: Record<string, string>;
}

export async function handleSSE(
  req: Request,
  ctx: ApiContext,
  options: SSEOptions
): Promise<Response> {
  const { table, filters } = options;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Send connected event
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`)
        );

        // Track SSE connection for usage metrics
        trackSseConnect(ctx.orgId);

        // Subscribe to changes (using projectId for data scoping)
        // Pass auth context for RLS filtering
        const authContext = {
          authType: ctx.authType,
          userId: ctx.userId,
          tokenScopes: ctx.tokenScopes,
        };

        const unsubscribe = await subscribeToChanges(
          ctx.projectId,
          table,
          filters,
          authContext,
          (event) => {
            try {
              const eventType = event.op.toLowerCase();
              const data = JSON.stringify({
                id: event.id,
                data: event.data,
                ts: event.ts,
              });
              controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`));
            } catch {
              // Client disconnected
            }
          }
        );

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          trackSseDisconnect(ctx.orgId);
          unsubscribe();
          controller.close();
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Connection failed';
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
