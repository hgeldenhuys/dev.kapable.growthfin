/**
 * Auth Module
 * Authentication endpoints and middleware
 */

import { Elysia } from 'elysia';
import { authRoutes } from './routes';

export const authModule = new Elysia({ prefix: '', tags: ['Auth'] })
  .use(authRoutes);
