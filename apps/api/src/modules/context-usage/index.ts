/**
 * Context Usage Module
 * Tracks and reports context token usage from Claude Code sessions
 */

import { Elysia } from 'elysia';
import { contextUsageRoutes } from './routes';

export const contextUsageModule = new Elysia({ prefix: '/context-usage' })
  .use(contextUsageRoutes);
