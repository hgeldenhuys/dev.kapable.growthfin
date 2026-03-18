/**
 * Lists Service
 * Business logic for CRM list management (polymorphic entity support)
 */

import type { Database } from '@agios/db';
import { and, eq, sql, desc, isNull } from 'drizzle-orm';
import * as schema from '@agios/db/schema';
import type {
  CrmEntityType,
  ContactListType,
  ContactListStatus,
  NewCrmContactList,
  CrmContactList,
} from '@agios/db/schema/contact-lists';

/**
 * Get lists filtered by entity type and workspace
 */
export async function getListsByEntityType(
  db: Database,
  workspaceId: string,
  entityType?: CrmEntityType
): Promise<CrmContactList[]> {
  const conditions = [
    eq(schema.crmContactLists.workspaceId, workspaceId),
    isNull(schema.crmContactLists.deletedAt) // Exclude soft-deleted
  ];

  // Only filter by entity type if provided
  if (entityType) {
    conditions.push(eq(schema.crmContactLists.entityType, entityType));
  }

  const lists = await db
    .select()
    .from(schema.crmContactLists)
    .where(and(...conditions))
    .orderBy(desc(schema.crmContactLists.createdAt));

  return lists;
}

/**
 * Get a single list by ID with workspace validation
 */
export async function getListById(
  db: Database,
  listId: string,
  workspaceId: string
): Promise<CrmContactList | null> {
  const lists = await db
    .select()
    .from(schema.crmContactLists)
    .where(
      and(
        eq(schema.crmContactLists.id, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId),
        isNull(schema.crmContactLists.deletedAt)
      )
    )
    .limit(1);

  return lists[0] || null;
}

/**
 * Create a new list with validation
 */
export async function createList(
  db: Database,
  data: NewCrmContactList & { createdBy?: string }
): Promise<CrmContactList> {
  // Validate entity type
  const validEntityTypes: CrmEntityType[] = ['lead', 'contact', 'account', 'opportunity'];
  if (!validEntityTypes.includes(data.entityType as CrmEntityType)) {
    throw new Error(`Invalid entity type: ${data.entityType}`);
  }

  const [list] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId: data.workspaceId,
      entityType: data.entityType,
      name: data.name,
      description: data.description,
      type: data.type || 'manual',
      customFieldSchema: data.customFieldSchema || {},
      ownerId: data.ownerId,
      tags: data.tags || [],
      metadata: data.metadata || {},
      createdBy: data.createdBy,
      // Defaults that must be set
      totalContacts: 0,
      activeContacts: 0,
      enrichedContacts: 0,
      canBeRevived: true,
      revivalCount: 0,
    })
    .returning();

  return list;
}

/**
 * Update a list (partial update)
 */
export async function updateList(
  db: Database,
  listId: string,
  workspaceId: string,
  updates: Partial<NewCrmContactList> & { updatedBy?: string }
): Promise<CrmContactList | null> {
  // Verify ownership
  const existing = await getListById(db, listId, workspaceId);
  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(schema.crmContactLists)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.crmContactLists.id, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId)
      )
    )
    .returning();

  return updated;
}

/**
 * Soft delete a list
 */
export async function deleteList(
  db: Database,
  listId: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .update(schema.crmContactLists)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.crmContactLists.id, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Get recent lists (for CQRS initial state)
 */
export async function getRecentLists(
  db: Database,
  workspaceId: string,
  entityType: CrmEntityType | undefined,
  seconds: number = 86400
): Promise<CrmContactList[]> {
  const since = new Date(Date.now() - seconds * 1000);

  const conditions = [
    eq(schema.crmContactLists.workspaceId, workspaceId),
    isNull(schema.crmContactLists.deletedAt),
  ];

  if (entityType) {
    conditions.push(eq(schema.crmContactLists.entityType, entityType));
  }

  const lists = await db
    .select()
    .from(schema.crmContactLists)
    .where(and(...conditions))
    .orderBy(desc(schema.crmContactLists.createdAt));

  // Filter by time in JavaScript since SQL timestamp comparison is tricky
  return lists.filter(list => {
    const createdAt = new Date(list.createdAt);
    return createdAt >= since;
  });
}

export const listsService = {
  getListsByEntityType,
  getListById,
  createList,
  updateList,
  deleteList,
  getRecentLists,
};
