/**
 * LLM Configs Module
 * LLM service configuration management
 */

import { Elysia } from 'elysia';
import { llmConfigsRoutes } from './routes';

export const llmConfigsModule = new Elysia().use(llmConfigsRoutes);
