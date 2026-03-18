/**
 * API Route: Work Items SSE Stream (SignalDB Native SSE)
 *
 * React Router 7 SSE endpoint that connects to SignalDB's native SSE stream.
 * No API proxy - BFF connects to SignalDB for real-time streaming.
 *
 * Architecture: Browser -> BFF (localhost:5173) -> SignalDB (localhost:3003)
 * This eliminates CORS issues since browser and BFF are same-origin.
 *
 * Part of US-014: Batch/WorkItem Semantic Separation
 */

import type { Route } from "./+types/api.v1.work-items.stream";
import { isElectricAvailable, createElectricUnavailableResponse, buildSignalDBStreamUrl } from '~/lib/electric-check.server';

/**
 * Loader that streams work item updates from SignalDB's native SSE endpoint.
 *
 * Connects to SignalDB's /v1/work_items/stream SSE endpoint with filter params.
 * Reads the SSE event stream, converts snake_case data to camelCase, and
 * re-emits as SSE to the browser.
 *
 * Query parameters:
 * - workspaceId (required): Filter work items by workspace
 * - batchId (optional): Filter work items by batch
 */
export async function loader({ request }: Route.LoaderArgs) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('SSE stream can only be created on server');
  }

  // Extract query parameters from the request
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId');
  const batchId = url.searchParams.get('batchId');

  if (!workspaceId) {
    return new Response(
      JSON.stringify({ error: 'workspaceId query parameter is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const subscriptionTimestamp = new Date();

  // Check if SignalDB is available before starting stream
  const signalDBAvailable = await isElectricAvailable();
  if (!signalDBAvailable) {
    console.log(`[BFF SSE - Work Items] SignalDB not available - returning 503`);
    return createElectricUnavailableResponse();
  }

  console.log(`[BFF SSE - Work Items] Starting stream for workspace ${workspaceId}${batchId ? `, batch ${batchId}` : ''}`);

  // Create a ReadableStream that consumes SignalDB's native SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isRunning = true;
      let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

      // Send initial connection message
      controller.enqueue(encoder.encode(`: connected at ${subscriptionTimestamp.toISOString()}\n\n`));

      // Set up 20-second heartbeat to prevent timeout
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          // Controller may be closed, clear interval
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = undefined;
          }
        }
      }, 20000);

      try {
        // Build WHERE clause based on filters
        let whereClause = `workspace_id='${workspaceId}'`;
        if (batchId) {
          whereClause += ` AND batch_id='${batchId}'`;
        }

        // Connect to SignalDB's native SSE stream
        const streamUrl = buildSignalDBStreamUrl('work_items', whereClause);
        const response = await fetch(streamUrl, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`SignalDB error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (isRunning) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE messages from buffer
          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          let currentData = '';
          let currentEventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ') || line.startsWith('event:')) {
              currentEventType = line.slice(line.indexOf(':') + 1).trim();
            } else if (line.startsWith('data: ') || line.startsWith('data:')) {
              currentData += line.slice(line.indexOf(':') + 1).trim();
            } else if (line === '' && currentData) {
              // Empty line signals end of an SSE message

              // Skip delete events
              if (currentEventType === 'delete') {
                currentData = '';
                currentEventType = '';
                continue;
              }

              try {
                const parsed = JSON.parse(currentData);

                // SignalDB sends {id, data: {...row...}, ts} — extract row
                const row = parsed.data || parsed;

                // Skip events with no meaningful data (e.g. SignalDB keepalives with only "ts")
                const meaningfulKeys = Object.keys(row).filter(k => k !== 'ts' && k !== 'id');
                if (meaningfulKeys.length === 0) continue;

                // Convert snake_case to camelCase and emit as SSE
                const camelCasedValue = toCamelCase(row);
                const sseMessage = `data: ${JSON.stringify(camelCasedValue)}\n\n`;
                controller.enqueue(encoder.encode(sseMessage));
              } catch (e) {
                // Not valid JSON, skip
              }
              currentData = '';
              currentEventType = '';
            } else if (line === '') {
              currentData = '';
              currentEventType = '';
            }
          }
        }
      } catch (error: any) {
        // Only log non-abort errors
        if (error?.name !== 'AbortError') {
          console.error('[BFF SSE - Work Items] Stream error:', error);
          try {
            const errorMessage = `data: ${JSON.stringify({
              error: 'Stream error',
              message: String(error)
            })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
          } catch (e) {
            // Controller may be closed
          }
        }
      } finally {
        // Clear heartbeat interval on stream end
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = undefined;
        }
        try {
          controller.close();
        } catch (e) {
          // Controller may already be closed
        }
      }
    },

    cancel() {
      console.log('[BFF SSE - Work Items] Client disconnected');
      // Note: heartbeatInterval is cleared in finally block above
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

/**
 * Convert snake_case to camelCase recursively
 */
function toCamelCase(value: any): any {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(item => toCamelCase(item));
  }

  if (typeof value === 'string') {
    // Try to parse JSON strings (JSONB fields)
    if ((value.startsWith('[') && value.endsWith(']')) ||
        (value.startsWith('{') && value.endsWith('}'))) {
      try {
        return toCamelCase(JSON.parse(value));
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamelCase(val);
    }
    return result;
  }

  return value;
}
