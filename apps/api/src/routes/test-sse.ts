/**
 * Test SSE Route
 * Simple test to validate SSE works in ElysiaJS
 */

import { Elysia } from 'elysia';

export const testSSERoutes = new Elysia({ prefix: '/api/v1/test' })
  .get('/sse', async function* ({ set }) {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    console.log('[test-sse] Client connected');

    // Send initial connection message
    yield `: connected at ${new Date().toISOString()}\n\n`;

    // Send test messages every second for 10 seconds
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const message = {
        type: 'test',
        count: i,
        timestamp: new Date().toISOString(),
      };

      yield `data: ${JSON.stringify(message)}\n\n`;
      console.log(`[test-sse] Sent message ${i}`);
    }

    // Send completion message
    yield `data: ${JSON.stringify({ type: 'complete', message: 'Test finished' })}\n\n`;
    console.log('[test-sse] Stream completed');
  });
