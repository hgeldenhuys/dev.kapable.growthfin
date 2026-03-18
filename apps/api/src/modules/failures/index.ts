/**
 * Failures Module
 * Job failure monitoring and streaming
 */

import { Elysia } from 'elysia';
import { failuresRoutes } from './routes';

export const failuresModule = new Elysia().use(failuresRoutes);
