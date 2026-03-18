/**
 * Work Items Module
 * Work item management for batch/task semantic separation (US-014)
 */

import { Elysia } from 'elysia';
import { workItemsRoutes } from './routes/work-items.routes';

export const workItemsModule = new Elysia({ prefix: '/work-items', tags: ['Work Items'] })
  .use(workItemsRoutes);

// Export service and handlers for use in other modules
export { WorkItemsService } from './services/work-items.service';
export type { WorkItemFilters } from './services/work-items.service';
export {
  registerWorkItemTypeHandler,
  getWorkItemTypeHandler,
  getAllHandlers,
  leadConversionHandler,
} from './handlers';
export type { WorkItemTypeHandler } from './handlers';
