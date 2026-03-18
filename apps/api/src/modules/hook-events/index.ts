/**
 * Hook Events Module
 * Manages Claude Code hook events
 */

import { Elysia } from 'elysia';
import { hookEventRoutes } from './routes';

export const hookEventsModule = new Elysia({ prefix: '/hook-events' })
  .use(hookEventRoutes);
