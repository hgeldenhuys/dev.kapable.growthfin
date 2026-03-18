/**
 * Sessions Module
 * Real-time session streaming with Electric-SQL pattern
 */

import { Elysia } from 'elysia';
import { sessionsRoutes } from './routes';

export const sessionsModule = new Elysia().use(sessionsRoutes);
