/**
 * SSE Stream Proxy for /api/v1/stream/*
 *
 * This route proxies all /api/v1/stream/* requests (with paths) to the backend API.
 * It handles SSE connections and properly forwards event streams to the frontend.
 *
 * Examples:
 * - /api/v1/stream/crm/leads/scores
 * - /api/v1/stream/crm/analytics/metrics
 * - /api/v1/stream/crm/analytics/campaigns/:id/metrics
 */

import type { Route } from "./+types/api.v1.stream.$";

const API_URL = typeof window === 'undefined'
  ? (process.env.API_URL || 'http://localhost:3000')
  : '';

// Handle CORS preflight
export async function action({ request }: Route.ActionArgs) {
  if (request.method === 'OPTIONS') {
    // IMPORTANT: When using credentials, origin cannot be '*'
    const origin = request.headers.get('origin');
    const allowOrigin = origin || 'http://m4.local:5173';

    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return new Response('Method not allowed', { status: 405 });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('SSE stream can only be created on server');
  }

  const streamPath = params['*'] || '';
  const url = new URL(request.url);

  // Build backend URL with the stream path and query parameters
  const backendUrl = new URL(`${API_URL}/api/v1/stream/${streamPath}${url.search}`);

  console.log(`[SSE Proxy] Connecting to: ${backendUrl.toString()}`);

  // Create a ReadableStream that forwards data from backend
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let backendResponse: Response | null = null;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        // Connect to backend SSE endpoint
        // Forward cookies and authentication headers from the original request
        backendResponse = await fetch(backendUrl.toString(), {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            // Forward authentication headers
            ...(request.headers.get('cookie') && { 'Cookie': request.headers.get('cookie')! }),
            ...(request.headers.get('authorization') && { 'Authorization': request.headers.get('authorization')! }),
          },
          credentials: 'include', // Include cookies
          // @ts-ignore
          keepalive: true,
        });

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text();
          console.error(`[SSE Proxy] Backend error for ${streamPath}:`, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            error: errorText,
            url: backendUrl.toString(),
            hasCookie: !!request.headers.get('cookie'),
            origin: request.headers.get('origin'),
          });
          throw new Error(`Backend returned ${backendResponse.status}: ${errorText || backendResponse.statusText}`);
        }

        console.log(`[SSE Proxy] Connected to backend for path: ${streamPath}`);

        // Forward the stream
        reader = backendResponse.body?.getReader();
        if (!reader) {
          throw new Error('No response body from backend');
        }

        // Send initial connection confirmation message
        const connectedMessage = `data: ${JSON.stringify({ type: 'connected', path: streamPath })}\n\n`;
        controller.enqueue(encoder.encode(connectedMessage));

        // Stream data chunk by chunk
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log(`[SSE Proxy] Stream ended for path: ${streamPath}`);
              break;
            }

            // Forward the chunk as-is
            controller.enqueue(value);
          }
        } catch (readError: any) {
          // Only log if it's NOT a normal connection reset
          if (readError?.code !== 'ECONNRESET') {
            console.warn(`[SSE Proxy] Stream read error for ${streamPath}:`, readError);
          }
        }

        controller.close();
      } catch (error) {
        console.error(`[SSE Proxy] Stream error for ${streamPath}:`, error);

        try {
          // Send error message in SSE format
          const errorMessage = `data: ${JSON.stringify({
            error: 'Proxy stream error',
            path: streamPath,
            message: String(error)
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        } catch (enqueueError) {
          console.error('[SSE Proxy] Could not send error message:', enqueueError);
        }

        try {
          controller.close();
        } catch (closeError) {
          console.error('[SSE Proxy] Error closing controller:', closeError);
        }
      } finally {
        // Cleanup
        if (reader) {
          try {
            await reader.cancel();
          } catch (e) {
            // Suppress expected cancellation messages
          }
        }
      }
    },

    cancel() {
      console.log(`[SSE Proxy] Client disconnected from path: ${streamPath}`);
    },
  });

  // Get origin for CORS
  // IMPORTANT: When using credentials, origin cannot be '*'
  const origin = request.headers.get('origin');
  const allowOrigin = origin || 'http://m4.local:5173'; // Fallback to default

  // Return Response with proper SSE headers and CORS
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      // CORS headers for LAN access
      // Must specify exact origin (not '*') when using credentials
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    },
  });
}
