/**
 * Todos Module
 * Real-time todo streaming from Claude Code sessions
 */

import { Elysia } from 'elysia';
import { todosRoutes } from './routes';

export const todosModule = new Elysia().use(todosRoutes);
