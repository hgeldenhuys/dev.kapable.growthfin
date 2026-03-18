/**
 * Work Item Type Handlers Registry (UI-001)
 * Central registry for all work item type handlers
 */

import type { WorkItem } from '@agios/db';
import type {
  WorkItemTypeHandler,
  WorkItemAction,
  WorkItemHandlerContext,
} from './types';
import { leadConversionHandler } from './lead-conversion.handler';
import { followUpHandler } from './follow-up.handler';

// Export types
export type { WorkItemTypeHandler, WorkItemAction, WorkItemHandlerContext } from './types';

// Registry of all handlers
const handlers: WorkItemTypeHandler[] = [
  leadConversionHandler,
  followUpHandler,
];

/**
 * Get the appropriate handler for a work item
 */
export function getHandler(workItem: WorkItem): WorkItemTypeHandler | null {
  for (const handler of handlers) {
    if (handler.canHandle(workItem)) {
      return handler;
    }
  }
  return null;
}

/**
 * Get all actions for a work item from all applicable handlers
 */
export function getActionsForWorkItem(
  workItem: WorkItem,
  context: WorkItemHandlerContext
): WorkItemAction[] {
  const handler = getHandler(workItem);
  if (!handler) {
    return [];
  }
  return handler.getActions(workItem, context);
}

/**
 * Register a new handler (for extensibility)
 */
export function registerHandler(handler: WorkItemTypeHandler): void {
  // Check if handler with same ID exists
  const existingIndex = handlers.findIndex((h) => h.id === handler.id);
  if (existingIndex >= 0) {
    handlers[existingIndex] = handler;
  } else {
    handlers.push(handler);
  }
}

/**
 * Get all registered handlers (for debugging/testing)
 */
export function getAllHandlers(): WorkItemTypeHandler[] {
  return [...handlers];
}
