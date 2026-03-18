/**
 * Job SSE Routes (JOBS-003)
 * Real-time job log streaming via Server-Sent Events
 *
 * Endpoints:
 * - GET /jobs/:jobId/sse - Stream job_logs updates in real-time
 *
 * Architecture:
 * - Uses SignalDB for sub-500ms latency updates
 * - Follows CQRS pattern: GET /logs (snapshot) + GET /sse (deltas)
 * - Heartbeat every 30s to keep connection alive
 * - Automatic reconnection handled by client (useSSE hook)
 */

import { Elysia, t } from 'elysia';
import { streamJobLogs } from '../../lib/electric-shapes';

export const jobSSERoutes = new Elysia({ prefix: '/jobs' })
  /**
   * GET /:jobId/sse - Stream job log updates in real-time
   *
   * Returns Server-Sent Events stream of job_logs table changes.
   * Uses SignalDB streaming for real-time database updates.
   *
   * Event types:
   * - Initial connection: comment message with timestamp
   * - Log updates: SSE messages from SignalDB (action: insert/update/delete)
   *
   * Connection lifecycle:
   * - Sends initial connection confirmation
   * - Streams all updates for the job
   * - Client handles reconnection with exponential backoff
   */
  .get(
    '/:jobId/sse',
    async function* ({ params, query, set }) {
      const { jobId } = params;
      const { workspaceId } = query;

      // Set SSE response headers
      // CRITICAL: Set headers object directly to avoid ElysiaJS appending text/plain
      set.headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering for immediate delivery
      };

      const subscriptionTimestamp = new Date();

      console.log(`[jobs/sse] Starting SSE stream for job ${jobId} at ${subscriptionTimestamp.toISOString()}`);

      // Send initial connection confirmation (SSE comment)
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Create SignalDB stream
        const signalStream = streamJobLogs(jobId, subscriptionTimestamp);

        // Stream job_logs updates
        let messageCount = 0;
        for await (const sseMessage of signalStream.stream()) {
          yield sseMessage;
          messageCount++;

          // Log every 10 messages for monitoring
          if (messageCount % 10 === 0) {
            console.log(`[jobs/sse] Streamed ${messageCount} messages for job ${jobId}`);
          }
        }

        console.log(`[jobs/sse] Stream ended for job ${jobId} after ${messageCount} messages`);
      } catch (error) {
        console.error(`[jobs/sse] Error streaming job ${jobId}:`, error);
        // Send error event to client
        yield `event: error\n`;
        yield `data: ${JSON.stringify({
          error: 'Stream error',
          jobId,
          message: error instanceof Error ? error.message : String(error)
        })}\n\n`;
      }
    },
    {
      params: t.Object({
        jobId: t.String({ description: 'Job ID (UUID)', format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({
          description: 'Workspace ID for authorization',
          format: 'uuid',
        }),
      }),
      detail: {
        tags: ['Job Observability'],
        summary: 'Stream job log updates via SSE',
        description: 'Real-time Server-Sent Events stream of job_logs changes using SignalDB. Provides sub-500ms latency updates for job progress monitoring.',
      },
    }
  );
