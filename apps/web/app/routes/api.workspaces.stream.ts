/**
 * API Route: Workspace SSE Stream Proxy
 *
 * React Router 7 SSE endpoint that proxies workspace updates from Elysia backend.
 * This ensures reliable SSE headers and streaming using RR7's Response API.
 */

import type { Route } from "./+types/api.workspaces.stream";

const API_URL = typeof window === 'undefined'
  ? (process.env.API_URL || 'http://localhost:3000')
  : '';

/**
 * Loader that proxies SSE stream from Elysia backend
 *
 * Uses React Router 7's Response API to properly set SSE headers
 * and forward the stream from the backend with better reliability.
 */
export async function loader({ request }: Route.LoaderArgs) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('SSE stream can only be created on server');
  }

  console.log(`[RR7 SSE Proxy] Connecting to backend at ${API_URL}/api/v1/workspaces/stream`);

  // Create a ReadableStream that forwards data from Elysia backend
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let backendResponse: Response | null = null;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        // Connect to Elysia backend SSE endpoint
        backendResponse = await fetch(`${API_URL}/api/v1/workspaces/stream`, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          // @ts-ignore - Set keepalive to prevent connection termination
          keepalive: true,
        });

        if (!backendResponse.ok) {
          throw new Error(`Backend returned ${backendResponse.status}: ${backendResponse.statusText}`);
        }

        console.log('[RR7 SSE Proxy] Connected to backend, streaming...');

        // Forward the stream
        reader = backendResponse.body?.getReader();
        if (!reader) {
          throw new Error('No response body from backend');
        }

        // Stream data chunk by chunk with error handling
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('[RR7 SSE Proxy] Backend stream ended normally');
              break;
            }

            // Forward the chunk as-is
            controller.enqueue(value);
          }
        } catch (readError) {
          // Handle stream read errors (e.g., connection terminated)
          console.warn('[RR7 SSE Proxy] Stream read error (client may have disconnected):', readError);
          // Don't re-throw - just close gracefully
        }

        controller.close();
      } catch (error) {
        console.error('[RR7 SSE Proxy] Stream error:', error);

        try {
          // Send error message in SSE format
          const errorMessage = `data: ${JSON.stringify({
            error: 'Proxy stream error',
            message: String(error)
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        } catch (enqueueError) {
          // Controller may already be closed
          console.error('[RR7 SSE Proxy] Could not send error message:', enqueueError);
        }

        try {
          controller.close();
        } catch (closeError) {
          // Controller may already be closed
          console.error('[RR7 SSE Proxy] Error closing controller:', closeError);
        }
      } finally {
        // Cleanup
        if (reader) {
          try {
            await reader.cancel();
          } catch (e) {
            // Ignore cancelation errors
            console.debug('[RR7 SSE Proxy] Reader cancelation error (expected on disconnect)');
          }
        }
      }
    },

    cancel() {
      console.log('[RR7 SSE Proxy] Client disconnected');
    },
  });

  // Return Response with proper SSE headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
