/**
 * Workspaces Module
 * Manages workspace CRUD operations
 */

import { Elysia } from 'elysia';
import { workspaceRoutes } from './routes';

export const workspacesModule = new Elysia().use(workspaceRoutes);
