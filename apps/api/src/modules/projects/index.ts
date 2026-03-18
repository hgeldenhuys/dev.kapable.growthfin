/**
 * Projects Module
 * Manages project CRUD operations
 */

import { Elysia } from 'elysia';
import { projectRoutes } from './routes';

export const projectsModule = new Elysia().use(projectRoutes);

export * from './service';
export * from './routes';
