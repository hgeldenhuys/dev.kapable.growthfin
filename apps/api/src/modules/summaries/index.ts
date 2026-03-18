/**
 * Summaries Module
 * Real-time event summary streaming
 */

import { Elysia } from 'elysia';
import { summariesRoutes } from './routes';

export const summariesModule = new Elysia().use(summariesRoutes);
