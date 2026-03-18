/**
 * Download Module
 * Serves SDK bundles and downloadable assets
 */

import { Elysia } from 'elysia';
import { downloadRoutes } from './routes';

export const downloadModule = new Elysia()
  .use(downloadRoutes);
