/**
 * Tags Module
 * Manages tag analytics and history
 */

import { Elysia } from 'elysia';
import { tagsRoutes } from './routes';

export const tagsModule = new Elysia({ prefix: '/tags' })
  .use(tagsRoutes);
