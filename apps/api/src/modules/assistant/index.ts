/**
 * Assistant Module
 * AI-powered chat assistant
 */

import { Elysia } from 'elysia';
import { assistantRoutes } from './routes';

export const assistantModule = new Elysia().use(assistantRoutes);
