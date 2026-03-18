/**
 * API Route: Batches SSE Stream (SignalDB Native SSE)
 *
 * React Router 7 SSE endpoint that connects to SignalDB for real-time streaming.
 * No API proxy - BFF connects directly to SignalDB's native SSE endpoint.
 *
 * Architecture: Browser -> BFF (localhost:5173) -> SignalDB (localhost:3003)
 * This eliminates CORS issues since browser and BFF are same-origin.
 *
 * Part of US-014: Real-time Batch List with Inline Progress
 */

import type { Route } from "./+types/api.v1.crm.batches.stream";
import { buildSignalDBStreamUrl, isSignalDBAvailable, createSignalDBUnavailableResponse } from '~/lib/electric-check.server';

/**
 * Loader that streams batch updates from SignalDB native SSE
 *
 * Connects to SignalDB's /v1/crm_batches/stream endpoint and forwards
 * parsed SSE events to the browser. No long-polling or shape handles needed.
 *
 * Query parameters:
 * - workspaceId (required): Filter batches by workspace
 */
export async function loader({ request }: Route.LoaderArgs) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('SSE stream can only be created on server');
  }

  // Extract query parameters from the request
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId');

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
  const available = await isSignalDBAvailable();
  if (!available) {
    console.log(`[BFF SSE - Batches] SignalDB not available - returning 503`);
    return createSignalDBUnavailableResponse();
  }

  console.log(`[BFF SSE - Batches] Starting stream for workspace ${workspaceId}`);

  // Build SignalDB native SSE URL with filters
  const whereClause = `workspace_id='${workspaceId}'`;
  const signalDbUrl = buildSignalDBStreamUrl('crm_batches', whereClause);

  // Create a ReadableStream that connects to SignalDB native SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
      let abortController: AbortController | null = new AbortController();

      // Send initial connection message
      controller.enqueue(encoder.encode(`: connected at ${subscriptionTimestamp.toISOString()}\n\n`));

      // US-014 AC-002: Set up 20-second heartbeat to prevent timeout
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
        // Connect to SignalDB native SSE endpoint
        const response = await fetch(signalDbUrl, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`SignalDB error: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('SignalDB response has no body');
        }

        // Parse the SSE stream from SignalDB
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('[BFF SSE - Batches] SignalDB stream ended');
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages (delimited by \n\n)
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || ''; // Keep incomplete message in buffer

            for (const message of messages) {
              if (!message.trim()) continue;

              const lines = message.split('\n');
              let eventType = '';

              for (const line of lines) {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  const dataStr = line.slice(5).trim();

                  // Skip empty/heartbeat data
                  if (!dataStr || dataStr === '""') continue;

                  try {
                    const event = JSON.parse(dataStr);
                    const operation = eventType || event.operation;

                    // Skip DELETE operations
                    if (operation === 'delete') continue;

                    // SignalDB sends row data as 'data', fall back to 'row'
                    const row = event.data || event.row;
                    if (!row) continue;

                    // Skip minimal updates (only id + timestamp changed)
                    if (operation === 'update') {
                      const keys = Object.keys(row);
                      if (keys.length <= 2 && keys.includes('id') &&
                          (keys.includes('updated_at') || keys.includes('processed_at'))) {
                        continue;
                      }
                    }

                    // Skip events with no meaningful data (e.g. SignalDB keepalives with only "ts")
                    const meaningfulKeys = Object.keys(row).filter(k => k !== 'ts' && k !== 'id');
                    if (meaningfulKeys.length === 0) continue;

                    // Convert snake_case to camelCase and emit as SSE
                    const camelCasedValue = toCamelCase(row);
                    const sseMessage = `data: ${JSON.stringify(camelCasedValue)}\n\n`;
                    controller.enqueue(encoder.encode(sseMessage));
                  } catch {
                    // Not JSON -- might be a keepalive or comment, skip
                  }
                }
                // SSE comments (lines starting with ':') are silently skipped
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error: any) {
        // Only log non-abort errors
        if (error?.name !== 'AbortError') {
          console.error('[BFF SSE - Batches] Stream error:', error);
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
        // US-014 AC-002: Clear heartbeat interval on stream end
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = undefined;
        }
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        try {
          controller.close();
        } catch (e) {
          // Controller may already be closed
        }
      }
    },

    cancel() {
      console.log('[BFF SSE - Batches] Client disconnected');
      // Note: heartbeatInterval and abortController are cleaned up in finally block above
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
