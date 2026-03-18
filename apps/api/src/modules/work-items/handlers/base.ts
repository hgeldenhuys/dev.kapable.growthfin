/**
 * Work Item Type Handler Base Interface
 * Extensible pattern for handling different work item types (US-014)
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { WorkItem, WorkItemType } from '@agios/db';

/**
 * Base interface for work item type handlers
 */
export interface WorkItemTypeHandler {
  /**
   * The work item type this handler manages
   */
  type: WorkItemType;

  /**
   * Validate work item metadata for this type
   */
  validateMetadata(metadata: any): { valid: boolean; errors?: string[] };

  /**
   * Execute the work item (optional - may be delegated to workers)
   */
  execute?(workItem: WorkItem, db: PostgresJsDatabase): Promise<void>;

  /**
   * Get display information for UI rendering
   */
  getDisplayInfo?(workItem: WorkItem): {
    icon?: string;
    color?: string;
    subtitle?: string;
  };
}
