/**
 * Generic SSE Stream Proxy
 *
 * Multiplexed SSE endpoint that can stream any table from ElectricSQL.
 * Supports query parameters for table, where clause, and columns.
 *
 * Usage:
 *   /api/stream?table=workspaces
 *   /api/stream?table=personas&where=project_id='123'
 *   /api/stream?table=sessions&where=project_id='abc'&columns=id,title,status
 */

import type { Route } from "./+types/api.stream";

const API_URL = typeof window === 'undefined'
  ? (process.env.API_URL || 'http://localhost:3000')
  : '';

/**
 * Generic SSE loader that proxies streams from backend
 *
 * Query Parameters:
 * - table: Table name to stream (required)
 * - where: SQL where clause (optional)
 * - columns: Comma-separated column list (optional)
 */
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

  // Build backend URL with query parameters
  const backendUrl = new URL(`${API_URL}/api/v1/stream`);
  backendUrl.searchParams.set('table', table);

  const where = url.searchParams.get('where');
  if (where) {
    backendUrl.searchParams.set('where', where);
  }

  const columns = url.searchParams.get('columns');
  if (columns) {
    backendUrl.searchParams.set('columns', columns);
  }

  console.log(`[Generic SSE Proxy] Connecting to: ${backendUrl.toString()}`);

  // Create a ReadableStream that forwards data from backend
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let backendResponse: Response | null = null;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        // Connect to backend generic SSE endpoint
        backendResponse = await fetch(backendUrl.toString(), {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          // @ts-ignore
          keepalive: true,
        });

        if (!backendResponse.ok) {
          throw new Error(`Backend returned ${backendResponse.status}: ${backendResponse.statusText}`);
        }

        console.log(`[Generic SSE Proxy] Connected to backend for table: ${table}`);

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
              console.log(`[Generic SSE Proxy] Backend stream ended for table: ${table}`);
              break;
            }

            // Forward the chunk as-is
            controller.enqueue(value);
          }
        } catch (readError) {
          // Handle stream read errors gracefully
          console.warn(`[Generic SSE Proxy] Stream read error for table ${table}:`, readError);
        }

        controller.close();
      } catch (error) {
        console.error(`[Generic SSE Proxy] Stream error for table ${table}:`, error);

        try {
          // Send error message in SSE format
          const errorMessage = `data: ${JSON.stringify({
            error: 'Proxy stream error',
            table,
            message: String(error)
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        } catch (enqueueError) {
          console.error('[Generic SSE Proxy] Could not send error message:', enqueueError);
        }

        try {
          controller.close();
        } catch (closeError) {
          console.error('[Generic SSE Proxy] Error closing controller:', closeError);
        }
      } finally {
        // Cleanup
        if (reader) {
          try {
            await reader.cancel();
          } catch (e) {
            console.debug('[Generic SSE Proxy] Reader cancelation error (expected on disconnect)');
          }
        }
      }
    },

    cancel() {
      console.log(`[Generic SSE Proxy] Client disconnected from table: ${table}`);
    },
  });

  // Return Response with proper SSE headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
