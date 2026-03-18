/**
 * SDLC Stream Route
 * SSE endpoint for real-time file change notifications via ElectricSQL
 */

import { Elysia } from 'elysia';
import { streamSDLCFiles } from '../../../lib/electric-shapes';

export const streamRoute = new Elysia()
  .get('/stream', async ({ set, query }) => {
    console.log('[SDLC Stream] Client connected');

    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    const encoder = new TextEncoder();
    const subscriptionTimestamp = new Date();

    // Optional session filter from query params
    const sessionId = query.sessionId as string | undefined;

    const stream = new ReadableStream({
      async start(controller) {
        let heartbeatInterval: Timer | undefined;

        try {
          // Send initial connection confirmation
          const timestamp = new Date().toISOString();
          controller.enqueue(encoder.encode(`: connected at ${timestamp}\n\n`));
          console.log('[SDLC Stream] Sent connection confirmation');

          // Send heartbeat every 15 seconds to keep connection alive
          heartbeatInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            } catch (e) {
              // Controller closed, clear interval
              if (heartbeatInterval) clearInterval(heartbeatInterval);
            }
          }, 15000);

          // Stream from ElectricSQL
          const electricStream = streamSDLCFiles(sessionId, subscriptionTimestamp);

          console.log('[SDLC Stream] Streaming from ElectricSQL (sdlc_files table)');

          // Forward Electric SSE messages to client
          for await (const sseMessage of electricStream.stream()) {
            controller.enqueue(encoder.encode(sseMessage));
          }

        } catch (error) {
          console.error('[SDLC Stream] Error in stream:', error);
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          try {
            const errorMessage = `data: ${JSON.stringify({
              error: 'Stream error',
              message: String(error)
            })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
          } catch (e) {
            // Controller already closed
          }
          controller.close();
        }
      },

      async cancel() {
        console.log('[SDLC Stream] Client disconnected');
      }
    });

    return new Response(stream);
  }, {
    detail: {
      tags: ['SDLC'],
      summary: 'Stream SDLC file changes',
      description: 'Real-time SSE stream of file change events via ElectricSQL (created, updated, deleted)',
    },
  });
