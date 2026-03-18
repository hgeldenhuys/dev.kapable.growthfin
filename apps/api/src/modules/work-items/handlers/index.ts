/**
 * Work Item Type Handler Registry
 * Central registry for all work item type handlers (US-014)
 */

import type { WorkItemType } from '@agios/db';
import type { WorkItemTypeHandler } from './base';
import { leadConversionHandler } from './lead-conversion';

/**
 * Handler Registry
 */
const handlerRegistry = new Map<WorkItemType, WorkItemTypeHandler>();

/**
 * Register a work item type handler
 */
export function registerWorkItemTypeHandler(handler: WorkItemTypeHandler): void {
  handlerRegistry.set(handler.type, handler);
}

/**
 * Get work item type handler
 */
export function getWorkItemTypeHandler(
  type: WorkItemType
): WorkItemTypeHandler | undefined {
  return handlerRegistry.get(type);
}

/**
 * Get all registered handlers
 */
export function getAllHandlers(): WorkItemTypeHandler[] {
  return Array.from(handlerRegistry.values());
}

// Register built-in handlers
registerWorkItemTypeHandler(leadConversionHandler);

// Export handler types and implementations
export type { WorkItemTypeHandler } from './base';
export { leadConversionHandler } from './lead-conversion';
