/**
 * API Route: Leads SSE Stream (SignalDB Native SSE)
 *
 * React Router 7 SSE endpoint that connects to SignalDB for real-time streaming.
 * No API proxy - BFF connects to SignalDB and re-emits events to the browser.
 *
 * Architecture: Browser -> BFF (localhost:5173) -> SignalDB (localhost:3003)
 * This eliminates CORS issues since browser and BFF are same-origin.
 *
 * Part of ARCH-001: SignalDB Real-Time Architecture
 */

import type { Route } from "./+types/api.v1.crm.leads.stream";
import { isElectricAvailable, createElectricUnavailableResponse, buildSignalDBStreamUrl } from '~/lib/electric-check.server';

/**
 * Loader that streams lead updates from SignalDB via native SSE
 *
 * Connects to SignalDB's SSE stream endpoint and forwards events to the browser.
 * Converts snake_case field names to camelCase for frontend consumption.
 *
 * Query parameters:
 * - workspaceId (required): Filter leads by workspace
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
  const available = await isElectricAvailable();
  if (!available) {
    console.log(`[BFF SSE - Leads] SignalDB not available - returning 503`);
    return createElectricUnavailableResponse();
  }

  console.log(`[BFF SSE - Leads] Starting stream for workspace ${workspaceId}`);

  // Build SignalDB stream URL with workspace filter
  const whereClause = `workspace_id='${workspaceId}'`;
  const streamUrl = buildSignalDBStreamUrl('crm_leads', whereClause);

  // Create a ReadableStream that consumes SignalDB's native SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
      let abortController: AbortController | undefined;

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
        // Connect to SignalDB native SSE stream
        abortController = new AbortController();
        const response = await fetch(streamUrl, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`SignalDB stream error: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('SignalDB stream returned no body');
        }

        // Read the SSE stream from SignalDB
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by double newlines)
          const events = buffer.split('\n\n');
          // Keep the last incomplete chunk in the buffer
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            // Skip SSE comments (heartbeats from SignalDB)
            if (event.startsWith(':')) {
              continue;
            }

            // Extract event type and data from SSE lines
            const lines = event.split('\n');
            let eventType = '';
            const dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
              }
            }

            if (dataLines.length === 0) continue;

            // Skip delete events from event: line
            if (eventType === 'delete') continue;

            const dataStr = dataLines.join('');

            try {
              const parsed = JSON.parse(dataStr);

              // Handle array of records or single record
              const records = Array.isArray(parsed) ? parsed : [parsed];

              for (const record of records) {
                // SignalDB sends {id, data: {...row...}, ts} with event: type
                // Extract the row from 'data' field if present
                const row = record.data || record;

                // Skip deletes (from __deleted or __operation metadata)
                if (record.__deleted || record.__operation === 'delete') {
                  continue;
                }

                // Skip minimal updates (only timestamp changed)
                const operation = record.__operation || record.operation;
                if (operation === 'update') {
                  const keys = Object.keys(row).filter(k => !k.startsWith('__'));
                  if (keys.length <= 2 && keys.includes('id') &&
                      (keys.includes('updated_at') || keys.includes('processed_at'))) {
                    continue;
                  }
                }

                // Remove internal metadata fields
                const cleanRecord = { ...row };
                for (const key of Object.keys(cleanRecord)) {
                  if (key.startsWith('__')) {
                    delete cleanRecord[key];
                  }
                }

                // Skip events with no meaningful data (e.g. SignalDB keepalives with only "ts")
                const meaningfulKeys = Object.keys(cleanRecord).filter(k => k !== 'ts' && k !== 'id');
                if (meaningfulKeys.length === 0) {
                  continue;
                }

                // Convert snake_case to camelCase and emit as SSE
                const camelCasedValue = toCamelCase(cleanRecord);
                const sseMessage = `data: ${JSON.stringify(camelCasedValue)}\n\n`;
                controller.enqueue(encoder.encode(sseMessage));
              }
            } catch (e) {
              // Not valid JSON - forward as-is if it looks like a data event
              if (dataStr && !dataStr.startsWith('{') && !dataStr.startsWith('[')) {
                continue; // Skip non-JSON events
              }
            }
          }
        }
      } catch (error: any) {
        // Only log non-abort errors
        if (error?.name !== 'AbortError') {
          console.error('[BFF SSE - Leads] Stream error:', error);
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
        // Abort upstream SignalDB connection
        if (abortController) {
          abortController.abort();
        }
        try {
          controller.close();
        } catch (e) {
          // Controller may already be closed
        }
      }
    },

    cancel() {
      console.log('[BFF SSE - Leads] Client disconnected');
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
