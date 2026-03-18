/**
 * SSE Stream Proxy for /api/v1/stream
 *
 * This file creates a route at /api/v1/stream that proxies to the backend API.
 * It handles the SSE connection and forwards events to the frontend.
 */

import type { Route } from "./+types/api.v1.stream";
import { isElectricAvailable, createElectricUnavailableResponse } from '~/lib/electric-check.server';

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

export async function loader({ request }: Route.LoaderArgs) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('SSE stream can only be created on server');
  }

  const url = new URL(request.url);
  const table = url.searchParams.get('table');

  if (!table) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: table' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if ElectricSQL is available before starting stream
  const electricAvailable = await isElectricAvailable();
  if (!electricAvailable) {
    console.log(`[SSE Proxy v1] ElectricSQL not available for table ${table} - returning 503`);
    return createElectricUnavailableResponse();
  }

  // Build backend URL with query parameters
  const backendUrl = new URL(`${API_URL}/api/v1/stream`);

  // Forward all query parameters
  url.searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  // Suppress connection logs - only log errors
  // console.log(`[SSE Proxy v1] Connecting to: ${backendUrl.toString()}`);

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
          console.error(`[SSE Proxy v1] Backend error for table ${table}:`, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            error: errorText,
            url: backendUrl.toString(),
            hasCookie: !!request.headers.get('cookie'),
            origin: request.headers.get('origin'),
          });
          throw new Error(`Backend returned ${backendResponse.status}: ${errorText || backendResponse.statusText}`);
        }

        console.log(`[SSE Proxy v1] Connected to backend for table: ${table}`);

        // Forward the stream
        reader = backendResponse.body?.getReader();
        if (!reader) {
          throw new Error('No response body from backend');
        }

        // Send initial connection confirmation message
        const connectedMessage = `data: ${JSON.stringify({ type: 'connected', table })}\n\n`;
        controller.enqueue(encoder.encode(connectedMessage));

        // Stream data chunk by chunk
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Normal stream end - don't log
              break;
            }

            // Forward the chunk as-is
            controller.enqueue(value);
          }
        } catch (readError: any) {
          // Only log if it's NOT a normal connection reset
          if (readError?.code !== 'ECONNRESET') {
            console.warn(`[SSE Proxy v1] Stream read error for table ${table}:`, readError);
          }
          // ECONNRESET is expected when connections close - silently ignore
        }

        controller.close();
      } catch (error) {
        console.error(`[SSE Proxy v1] Stream error for table ${table}:`, error);

        try {
          // Send error message in SSE format
          const errorMessage = `data: ${JSON.stringify({
            error: 'Proxy stream error',
            table,
            message: String(error)
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        } catch (enqueueError) {
          console.error('[SSE Proxy v1] Could not send error message:', enqueueError);
        }

        try {
          controller.close();
        } catch (closeError) {
          console.error('[SSE Proxy v1] Error closing controller:', closeError);
        }
      } finally {
        // Cleanup
        if (reader) {
          try {
            await reader.cancel();
          } catch (e) {
            // Suppress expected cancellation messages
            // console.debug('[SSE Proxy v1] Reader cancelation error (expected on disconnect)');
          }
        }
      }
    },

    cancel() {
      // Suppress normal disconnection logs
      // console.log(`[SSE Proxy v1] Client disconnected from table: ${table}`);
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