/**
 * Hierarchy Validator
 *
 * Detects circular references in account parent-child relationships using DFS traversal.
 * Prevents data integrity issues from invalid hierarchies.
 *
 * @module hierarchy-validator
 */

import { Database } from '../../../lib/db';
import { crmAccounts } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';

export interface CircularReferenceResult {
  isValid: boolean;
  cycle: string[] | null;
  error: string | null;
}

/**
 * Detects circular references in account hierarchy
 *
 * Algorithm: Depth-First Search (DFS) up the parent chain
 * - Limit: 10 levels deep (prevents infinite loops)
 * - Returns cycle path if detected
 * - Respects workspace isolation
 *
 * @param accountId - ID of the account being updated
 * @param newParentId - ID of the proposed parent account
 * @param workspaceId - Workspace ID for isolation
 * @param db - Database instance
 * @returns Result indicating if hierarchy is valid or cycle details
 *
 * @example
 * ```typescript
 * const result = await detectCircularReference('account-a', 'account-b', 'workspace-1', db);
 * if (!result.isValid) {
 *   console.error(`Cycle detected: ${result.cycle.join(' → ')}`);
 * }
 * ```
 */
export async function detectCircularReference(
  accountId: string,
  newParentId: string,
  workspaceId: string,
  db: Database
): Promise<CircularReferenceResult> {
  // Edge case: account cannot be its own parent
  if (accountId === newParentId) {
    return {
      isValid: false,
      cycle: [accountId, accountId],
      error: 'Account cannot be its own parent',
    };
  }

  // DFS traversal up parent chain
  const visited = new Set<string>();
  const path: string[] = [accountId];
  let currentId: string | null = newParentId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (currentId && depth < MAX_DEPTH) {
    // Cycle detected - either we've seen this node OR we've reached the account being updated
    if (visited.has(currentId) || currentId === accountId) {
      // Find where cycle starts
      const cycleStartIndex = path.indexOf(currentId);
      const cycle = [...path.slice(cycleStartIndex), currentId];

      return {
        isValid: false,
        cycle,
        error: 'Circular reference detected',
      };
    }

    // Mark as visited and add to path
    visited.add(currentId);
    path.push(currentId);

    // Query parent of current account
    const parent = await db.query.crmAccounts.findFirst({
      where: and(
        eq(crmAccounts.id, currentId),
        eq(crmAccounts.workspaceId, workspaceId)
      ),
      columns: {
        parentAccountId: true,
      },
    });

    // Move up to parent (or null if no parent)
    currentId = parent?.parentAccountId || null;
    depth++;
  }

  // No cycle detected
  return {
    isValid: true,
    cycle: null,
    error: null,
  };
}

/**
 * Validates account hierarchy before create/update operations
 *
 * Convenience wrapper around detectCircularReference that throws on invalid hierarchy.
 *
 * @param accountId - ID of the account
 * @param newParentId - Proposed parent ID
 * @param workspaceId - Workspace ID
 * @param db - Database instance
 * @throws Error if circular reference detected
 *
 * @example
 * ```typescript
 * try {
 *   await validateAccountHierarchy(accountId, parentId, workspaceId, db);
 *   // Proceed with update
 * } catch (error) {
 *   // Handle circular reference error
 * }
 * ```
 */
export async function validateAccountHierarchy(
  accountId: string,
  newParentId: string | null,
  workspaceId: string,
  db: Database
): Promise<void> {
  // No validation needed if no parent
  if (!newParentId) {
    return;
  }

  const result = await detectCircularReference(accountId, newParentId, workspaceId, db);

  if (!result.isValid) {
    const cycleString = result.cycle?.join(' → ') || 'Unknown';
    throw new Error(
      `${result.error}: Setting this parent would create a circular dependency. Path: ${cycleString}`
    );
  }
}
