/**
 * Users Module
 * User profile management
 */

import { Elysia } from 'elysia';
import { userRoutes } from './routes';

export const usersModule = new Elysia()
  .use(userRoutes);

export { userService } from './service';
