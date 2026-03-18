/**
 * Custom Fields Routes
 * Provides SSE streaming for real-time custom field updates
 * US-CUSTOMFIELDS-004: Real-time updates via SSE
 */

import { Elysia } from 'elysia';
import { streamCustomFieldChanges } from '../../../services/custom-fields-notifications-service';

export const customFieldsRoutes = new Elysia({ prefix: '/custom-fields' })
  /**
   * Stream custom field changes via SSE
   * Returns Server-Sent Events stream for real-time updates
   */
  .get('/stream', async ({ headers, set }) => {
    const workspaceId = headers['x-workspace-id'];

    if (!workspaceId) {
      set.status = 400;
      return { error: 'Workspace ID required in x-workspace-id header' };
    }

    // Set SSE headers
    set.headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    };

    // Create and return the stream
    const stream = streamCustomFieldChanges(workspaceId);

    // Convert async generator to Response stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const data of stream) {
            // SSE format: data: {json}\n\n
            const chunk = encoder.encode(`data: ${data}\n\n`);
            controller.enqueue(chunk);
          }
        } catch (error) {
          console.error('[custom-fields-stream] Error in stream:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: set.headers,
    });
  });