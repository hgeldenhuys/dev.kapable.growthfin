/**
 * Work Items Service
 * Business logic for work item operations (US-014)
 */

import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql, lt, notInArray, count } from 'drizzle-orm';
import {
  workItems,
  type WorkItem,
  type NewWorkItem,
  type WorkItemStatus,
  type WorkItemType,
  type EntityType,
  type CompletedBy,
  type SourceType,
} from '@agios/db';

/**
 * Work Item Filters
 */
export interface WorkItemFilters {
  workspaceId: string;
  status?: WorkItemStatus | 'expired';
  entityType?: EntityType;
  entityId?: string;
  assignedTo?: string;
  workItemType?: WorkItemType;
  sourceType?: SourceType;
  sourceId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Source Progress Stats
 */
export interface SourceProgress {
  total: number;
  pending: number;
  claimed: number;
  inProgress: number;
  completed: number;
  expired: number;
  cancelled: number;
}

/**
 * Work Items Service
 */
export class WorkItemsService {
  /**
   * Create a new work item
   */
  static async create(
    db: PostgresJsDatabase,
    data: NewWorkItem
  ): Promise<WorkItem> {
    const [workItem] = await db
      .insert(workItems)
      .values({
        ...data,
        status: data.status || 'pending',
        metadata: data.metadata || {},
      })
      .returning();

    return workItem;
  }

  /**
   * Get work item by ID
   */
  static async getById(
    db: PostgresJsDatabase,
    id: string,
    workspaceId: string
  ): Promise<WorkItem | null> {
    const [workItem] = await db
      .select()
      .from(workItems)
      .where(
        and(
          eq(workItems.id, id),
          eq(workItems.workspaceId, workspaceId),
          sql`${workItems.deletedAt} IS NULL`
        )
      );

    return workItem ?? null;
  }

  /**
   * List work items with filters
   */
  static async list(
    db: PostgresJsDatabase,
    filters: WorkItemFilters
  ): Promise<{ workItems: WorkItem[]; total: number }> {
    const conditions = [
      eq(workItems.workspaceId, filters.workspaceId),
      sql`${workItems.deletedAt} IS NULL`,
    ];

    // Handle expired status specially
    if (filters.status === 'expired') {
      conditions.push(
        lt(workItems.expiresAt, new Date()),
        notInArray(workItems.status, ['completed', 'cancelled'])
      );
    } else if (filters.status) {
      conditions.push(eq(workItems.status, filters.status));
    }

    if (filters.entityType) {
      conditions.push(eq(workItems.entityType, filters.entityType));
    }

    if (filters.entityId && filters.entityId.trim()) {
      conditions.push(eq(workItems.entityId, filters.entityId));
    }

    if (filters.assignedTo && filters.assignedTo.trim()) {
      conditions.push(eq(workItems.assignedTo, filters.assignedTo));
    }

    if (filters.workItemType) {
      conditions.push(eq(workItems.workItemType, filters.workItemType));
    }

    // Provenance filters (UI-001)
    if (filters.sourceType) {
      conditions.push(eq(workItems.sourceType, filters.sourceType));
    }

    if (filters.sourceId && filters.sourceId.trim()) {
      conditions.push(eq(workItems.sourceId, filters.sourceId));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workItems)
      .where(and(...conditions));

    // Get work items
    const items = await db
      .select()
      .from(workItems)
      .where(and(...conditions))
      .orderBy(sql`${workItems.priority} DESC, ${workItems.createdAt} DESC`)
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    return {
      workItems: items,
      total: Number(count),
    };
  }

  /**
   * Update work item
   */
  static async update(
    db: PostgresJsDatabase,
    id: string,
    workspaceId: string,
    updates: Partial<NewWorkItem> & { updatedBy?: string }
  ): Promise<WorkItem> {
    const [workItem] = await db
      .update(workItems)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workItems.id, id),
          eq(workItems.workspaceId, workspaceId),
          sql`${workItems.deletedAt} IS NULL`
        )
      )
      .returning();

    if (!workItem) {
      throw new Error('Work item not found');
    }

    return workItem;
  }

  /**
   * Soft delete work item
   */
  static async delete(
    db: PostgresJsDatabase,
    id: string,
    workspaceId: string
  ): Promise<WorkItem> {
    const [workItem] = await db
      .update(workItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workItems.id, id),
          eq(workItems.workspaceId, workspaceId),
          sql`${workItems.deletedAt} IS NULL`
        )
      )
      .returning();

    if (!workItem) {
      throw new Error('Work item not found');
    }

    return workItem;
  }

  /**
   * Claim work item atomically
   * Uses SELECT FOR UPDATE to prevent race conditions
   */
  static async claim(
    db: PostgresJsDatabase,
    id: string,
    workspaceId: string,
    userId: string
  ): Promise<WorkItem> {
    // Use transaction with SELECT FOR UPDATE to prevent race conditions
    return await db.transaction(async (tx) => {
      // Lock row and check if already claimed
      const [current] = await tx
        .select()
        .from(workItems)
        .where(
          and(
            eq(workItems.id, id),
            eq(workItems.workspaceId, workspaceId),
            sql`${workItems.deletedAt} IS NULL`
          )
        )
        .for('update');

      if (!current) {
        throw new Error('Work item not found');
      }

      // Check if already claimed
      if (current.status === 'claimed' || current.claimedBy) {
        throw new Error('Work item already claimed', {
          cause: { code: 'ALREADY_CLAIMED', claimedBy: current.claimedBy },
        });
      }

      // Claim the work item
      const [workItem] = await tx
        .update(workItems)
        .set({
          status: 'claimed',
          claimedBy: userId,
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workItems.id, id))
        .returning();

      return workItem;
    });
  }

  /**
   * Unclaim (release) work item
   */
  static async unclaim(
    db: PostgresJsDatabase,
    id: string,
    workspaceId: string
  ): Promise<WorkItem> {
    const [workItem] = await db
      .update(workItems)
      .set({
        status: 'pending',
        claimedBy: null,
        claimedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workItems.id, id),
          eq(workItems.workspaceId, workspaceId),
          sql`${workItems.deletedAt} IS NULL`
        )
      )
      .returning();

    if (!workItem) {
      throw new Error('Work item not found');
    }

    return workItem;
  }

  /**
   * Complete work item with result
   */
  static async complete(
    db: PostgresJsDatabase,
    id: string,
    workspaceId: string,
    completedBy: CompletedBy,
    result: any
  ): Promise<WorkItem> {
    const [workItem] = await db
      .update(workItems)
      .set({
        status: 'completed',
        completedBy,
        completedAt: new Date(),
        result,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workItems.id, id),
          eq(workItems.workspaceId, workspaceId),
          sql`${workItems.deletedAt} IS NULL`
        )
      )
      .returning();

    if (!workItem) {
      throw new Error('Work item not found');
    }

    return workItem;
  }

  // ============================================================================
  // PROVENANCE METHODS (UI-001)
  // ============================================================================

  /**
   * List work items by source (provenance)
   * Used to get all work items from a specific batch, campaign, etc.
   */
  static async listBySource(
    db: PostgresJsDatabase,
    workspaceId: string,
    sourceType: SourceType,
    sourceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ workItems: WorkItem[]; total: number }> {
    return this.list(db, {
      workspaceId,
      sourceType,
      sourceId,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  }

  /**
   * Get progress statistics for a specific source
   * Returns counts by status for a batch, campaign, etc.
   */
  static async getSourceProgress(
    db: PostgresJsDatabase,
    workspaceId: string,
    sourceType: SourceType,
    sourceId: string
  ): Promise<SourceProgress> {
    const conditions = [
      eq(workItems.workspaceId, workspaceId),
      eq(workItems.sourceType, sourceType),
      eq(workItems.sourceId, sourceId),
      sql`${workItems.deletedAt} IS NULL`,
    ];

    // Get counts grouped by status
    const results = await db
      .select({
        status: workItems.status,
        count: count(),
      })
      .from(workItems)
      .where(and(...conditions))
      .groupBy(workItems.status);

    // Initialize progress object
    const progress: SourceProgress = {
      total: 0,
      pending: 0,
      claimed: 0,
      inProgress: 0,
      completed: 0,
      expired: 0,
      cancelled: 0,
    };

    // Map results to progress
    for (const row of results) {
      const statusCount = Number(row.count);
      progress.total += statusCount;

      switch (row.status) {
        case 'pending':
          progress.pending = statusCount;
          break;
        case 'claimed':
          progress.claimed = statusCount;
          break;
        case 'in_progress':
          progress.inProgress = statusCount;
          break;
        case 'completed':
          progress.completed = statusCount;
          break;
        case 'expired':
          progress.expired = statusCount;
          break;
        case 'cancelled':
          progress.cancelled = statusCount;
          break;
      }
    }

    return progress;
  }

  /**
   * Get unique sources for work items in a workspace
   * Useful for populating source type filter dropdowns
   */
  static async getUniqueSources(
    db: PostgresJsDatabase,
    workspaceId: string
  ): Promise<Array<{ sourceType: SourceType; sourceId: string; count: number }>> {
    const results = await db
      .select({
        sourceType: workItems.sourceType,
        sourceId: workItems.sourceId,
        count: count(),
      })
      .from(workItems)
      .where(
        and(
          eq(workItems.workspaceId, workspaceId),
          sql`${workItems.deletedAt} IS NULL`,
          sql`${workItems.sourceType} IS NOT NULL`,
          sql`${workItems.sourceId} IS NOT NULL`
        )
      )
      .groupBy(workItems.sourceType, workItems.sourceId);

    return results.map((row) => ({
      sourceType: row.sourceType as SourceType,
      sourceId: row.sourceId as string,
      count: Number(row.count),
    }));
  }
}
