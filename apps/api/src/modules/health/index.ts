/**
 * Health Check Module
 * Simple health check endpoint
 */

import { Elysia } from 'elysia';

export const healthModule = new Elysia({ prefix: '/health' })
  .get('/', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))
  .get('/ready', ({ db }) => {
    // TODO: Add database health check
    return {
      status: 'ready',
      database: 'connected',
    };
  });
