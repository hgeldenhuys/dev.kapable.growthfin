/**
 * API Route: Job Logs SSE Stream (SignalDB Native SSE)
 *
 * React Router 7 SSE endpoint that connects DIRECTLY to SignalDB.
 * No API proxy - BFF connects to SignalDB for real-time streaming.
 *
 * Architecture: Browser -> BFF (localhost:5173) -> SignalDB (localhost:3003)
 * This eliminates CORS issues since browser and BFF are same-origin.
 *
 * Part of US-011: Task Execution Transparency
 */

import type { Route } from "./+types/api.v1.jobs.$jobId.sse";
import {
  buildSignalDBStreamUrl,
  isElectricAvailable,
  createElectricUnavailableResponse,
} from '~/lib/electric-check.server';

/**
 * Loader that streams job_logs updates directly from SignalDB
 *
 * Uses SignalDB's native SSE streaming endpoint with filter parameters.
 * Converts SignalDB events to SSE format for browser consumption, applying
 * snake_case to camelCase conversion on the data payload.
 *
 * Query parameters:
 * - workspaceId (required): For authorization
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('SSE stream can only be created on server');
  }

  const { jobId } = params;

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

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'jobId parameter is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check if SignalDB is available before starting stream
  const available = await isElectricAvailable();
  if (!available) {
    console.log(`[BFF SSE - JobLogs] SignalDB not available - returning 503`);
    return createElectricUnavailableResponse();
  }

  console.log(`[BFF SSE - JobLogs] Starting stream for job ${jobId}`);

  // Build SignalDB native SSE URL with job_id filter
  const signalDbUrl = buildSignalDBStreamUrl('job_logs', `job_id='${jobId}'`);

  // Create a ReadableStream that forwards SignalDB's native SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`));

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
        // Connect to SignalDB native SSE endpoint
        const response = await fetch(signalDbUrl, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`SignalDB error: ${response.status} ${response.statusText}`);
        }

        reader = response.body?.getReader() ?? null;
        if (!reader) {
          throw new Error('No response body from SignalDB');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        // Read and forward SSE chunks from SignalDB
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('[BFF SSE - JobLogs] SignalDB stream ended');
            break;
          }

          // Decode the chunk and append to buffer for line-based parsing
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (double newline delimited)
          const messages = buffer.split('\n\n');
          // Keep the last incomplete fragment in the buffer
          buffer = messages.pop() || '';

          for (const message of messages) {
            if (!message.trim()) continue;

            // Forward heartbeat/comment lines as-is
            if (message.startsWith(':')) {
              controller.enqueue(encoder.encode(message + '\n\n'));
              continue;
            }

            // Extract event type and data from SSE lines
            const lines = message.split('\n');
            let eventType = '';
            let rawData = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                rawData = line.slice(5).trim();
              }
            }

            if (!rawData) {
              // Forward non-data SSE lines as-is
              controller.enqueue(encoder.encode(message + '\n\n'));
              continue;
            }

            // Skip delete operations
            if (eventType === 'delete') continue;

            try {
              const parsed = JSON.parse(rawData);

              // Also check delete in data payload
              if (parsed?.operation === 'delete' || parsed?.headers?.operation === 'delete') {
                continue;
              }

              // Extract the value payload (SignalDB sends {id, data: {...}, ts})
              const valuePayload = parsed.data || parsed.value || parsed;

              // Skip events with no meaningful data (e.g. SignalDB keepalives with only "ts")
              const meaningfulKeys = Object.keys(valuePayload).filter(k => k !== 'ts' && k !== 'id');
              if (meaningfulKeys.length === 0) continue;

              // Convert snake_case to camelCase and emit
              const camelCasedValue = toCamelCase(valuePayload);
              const sseMessage = `data: ${JSON.stringify({ value: camelCasedValue })}\n\n`;
              controller.enqueue(encoder.encode(sseMessage));
            } catch (parseError) {
              // Not JSON - forward as-is
              controller.enqueue(encoder.encode(message + '\n\n'));
            }
          }
        }
      } catch (error: any) {
        // Only log non-abort errors
        if (error?.name !== 'AbortError') {
          console.error('[BFF SSE - JobLogs] Stream error:', error);
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
        // Clean up the upstream reader
        if (reader) {
          try {
            await reader.cancel();
          } catch (e) {
            // Expected on disconnect
          }
        }
        try {
          controller.close();
        } catch (e) {
          // Controller may already be closed
        }
      }
    },

    cancel() {
      console.log('[BFF SSE - JobLogs] Client disconnected');
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
