/**
 * Work Item Handler Types (UI-001)
 * Defines the handler pattern for context-appropriate work item actions
 */

import type { WorkItem, WorkItemType, EntityType } from '@agios/db';
import type { ReactNode } from 'react';

/**
 * Action definition for work item handlers
 */
export interface WorkItemAction {
  /** Unique action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon component */
  icon?: ReactNode;
  /** Action variant for styling */
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  /** Whether to show this action inline (vs in dropdown) */
  inline?: boolean;
  /** Handler function */
  onAction: (workItem: WorkItem, context: WorkItemHandlerContext) => void | Promise<void>;
}

/**
 * Context provided to handlers
 */
export interface WorkItemHandlerContext {
  workspaceId: string;
  userId?: string;
  navigate: (path: string) => void;
  onRefresh?: () => void;
  onClaim?: (workItemId: string) => Promise<void>;
  onComplete?: (workItemId: string, result?: any) => Promise<void>;
  onUnclaim?: (workItemId: string) => Promise<void>;
}

/**
 * Work Item Type Handler interface
 * Each handler provides actions appropriate for a specific work item type
 */
export interface WorkItemTypeHandler {
  /** Handler identifier */
  id: string;

  /** Work item types this handler supports */
  supportedTypes: WorkItemType[];

  /** Optional: Entity types this handler applies to */
  supportedEntityTypes?: EntityType[];

  /**
   * Check if this handler can handle a specific work item
   */
  canHandle(workItem: WorkItem): boolean;

  /**
   * Get available actions for a work item
   */
  getActions(workItem: WorkItem, context: WorkItemHandlerContext): WorkItemAction[];

  /**
   * Optional: Render custom content for the work item
   */
  renderContent?(workItem: WorkItem, context: WorkItemHandlerContext): ReactNode;
}
