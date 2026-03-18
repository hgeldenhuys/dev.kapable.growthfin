/**
 * List Operations Service
 * Business logic for list set operations: union, subtract, intersect, split
 * Supports all entity types (leads, contacts, accounts, opportunities)
 */

import type { Database } from '@agios/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import * as schema from '@agios/db/schema';
import type { CrmEntityType } from '@agios/db/schema/contact-lists';
import { getListMembers, type ListMemberWithEntity } from './list-members.service';

/**
 * UNION: Combine lists, deduplicate members
 * A ∪ B = {x | x ∈ A or x ∈ B}
 */
export async function union(
  db: Database,
  params: {
    workspaceId: string;
    sourceListIds: string[];
    name: string;
    userId: string;
  }
) {
  // 1. Validate all lists exist and have same entity_type
  const lists = await db
    .select()
    .from(schema.crmContactLists)
    .where(
      and(
        inArray(schema.crmContactLists.id, params.sourceListIds),
        eq(schema.crmContactLists.workspaceId, params.workspaceId),
        isNull(schema.crmContactLists.deletedAt)
      )
    );

  if (lists.length !== params.sourceListIds.length) {
    throw new Error('One or more lists not found');
  }

  const entityTypes = [...new Set(lists.map((l) => l.entityType))];
  if (entityTypes.length > 1) {
    throw new Error(
      `All lists must have the same entity type. Found: ${entityTypes.join(', ')}`
    );
  }

  const entityType = lists[0].entityType;

  // 2. Get all member IDs (deduplicated)
  const memberships = await db
    .select({ entityId: schema.crmContactListMemberships.entityId })
    .from(schema.crmContactListMemberships)
    .where(
      and(
        inArray(schema.crmContactListMemberships.listId, params.sourceListIds),
        eq(schema.crmContactListMemberships.entityType, entityType),
        isNull(schema.crmContactListMemberships.deletedAt)
      )
    );

  const uniqueEntityIds = [...new Set(memberships.map((m) => m.entityId))];

  // 3. Create derived list
  const [newList] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId: params.workspaceId,
      entityType,
      type: 'derived',
      status: 'active',
      name: params.name,
      customFieldSchema: lists[0].customFieldSchema,
      parentListId: params.sourceListIds[0], // Primary source
      totalContacts: uniqueEntityIds.length,
      activeContacts: uniqueEntityIds.length,
      enrichedContacts: 0,
      tags: [],
      metadata: {
        operation: 'union',
        sourceListIds: params.sourceListIds,
        sourceListNames: lists.map((l) => l.name),
      },
      createdBy: params.userId,
      updatedBy: params.userId,
      canBeRevived: true,
      revivalCount: 0,
    })
    .returning();

  // 4. Add members
  if (uniqueEntityIds.length > 0) {
    await db.insert(schema.crmContactListMemberships).values(
      uniqueEntityIds.map((entityId) => ({
        workspaceId: params.workspaceId,
        listId: newList.id,
        entityType,
        entityId,
        source: 'operation' as const,
        addedBy: params.userId,
        isActive: true,
        enrichmentData: {},
        metadata: { operation: 'union' },
        canBeRevived: true,
        revivalCount: 0,
        createdBy: params.userId,
      }))
    );
  }

  return { ...newList, memberCount: uniqueEntityIds.length };
}

/**
 * SUBTRACT: Members in A but NOT in B
 * A - B = {x | x ∈ A and x ∉ B}
 */
export async function subtract(
  db: Database,
  params: {
    workspaceId: string;
    sourceListId: string;
    subtractListId: string;
    name: string;
    userId: string;
  }
) {
  // Validate same entity_type
  const [sourceList, subtractList] = await Promise.all([
    getList(db, params.sourceListId, params.workspaceId),
    getList(db, params.subtractListId, params.workspaceId),
  ]);

  if (sourceList.entityType !== subtractList.entityType) {
    throw new Error(
      `Lists must have the same entity type. Source: ${sourceList.entityType}, Subtract: ${subtractList.entityType}`
    );
  }

  // Get member IDs
  const [sourceMembers, subtractMembers] = await Promise.all([
    getMemberIds(db, params.sourceListId),
    getMemberIds(db, params.subtractListId),
  ]);

  // Set difference
  const subtractSet = new Set(subtractMembers);
  const resultIds = sourceMembers.filter((id) => !subtractSet.has(id));

  // Create derived list
  const [newList] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId: params.workspaceId,
      entityType: sourceList.entityType,
      type: 'derived',
      status: 'active',
      name: params.name,
      customFieldSchema: sourceList.customFieldSchema,
      parentListId: params.sourceListId,
      totalContacts: resultIds.length,
      activeContacts: resultIds.length,
      enrichedContacts: 0,
      tags: [],
      metadata: {
        operation: 'subtract',
        sourceListId: params.sourceListId,
        sourceListName: sourceList.name,
        subtractListId: params.subtractListId,
        subtractListName: subtractList.name,
      },
      createdBy: params.userId,
      updatedBy: params.userId,
      canBeRevived: true,
      revivalCount: 0,
    })
    .returning();

  // Add members
  if (resultIds.length > 0) {
    await db.insert(schema.crmContactListMemberships).values(
      resultIds.map((entityId) => ({
        workspaceId: params.workspaceId,
        listId: newList.id,
        entityType: sourceList.entityType,
        entityId,
        source: 'operation' as const,
        addedBy: params.userId,
        isActive: true,
        enrichmentData: {},
        metadata: { operation: 'subtract' },
        canBeRevived: true,
        revivalCount: 0,
        createdBy: params.userId,
      }))
    );
  }

  return { ...newList, memberCount: resultIds.length };
}

/**
 * INTERSECT: Common members across all lists
 * A ∩ B = {x | x ∈ A and x ∈ B}
 */
export async function intersect(
  db: Database,
  params: {
    workspaceId: string;
    sourceListIds: string[];
    name: string;
    userId: string;
  }
) {
  // Validate same entity_type
  const lists = await db
    .select()
    .from(schema.crmContactLists)
    .where(
      and(
        inArray(schema.crmContactLists.id, params.sourceListIds),
        eq(schema.crmContactLists.workspaceId, params.workspaceId),
        isNull(schema.crmContactLists.deletedAt)
      )
    );

  if (lists.length !== params.sourceListIds.length) {
    throw new Error('One or more lists not found');
  }

  const entityTypes = [...new Set(lists.map((l) => l.entityType))];
  if (entityTypes.length > 1) {
    throw new Error(
      `All lists must have the same entity type. Found: ${entityTypes.join(', ')}`
    );
  }

  // Get all member ID sets
  const memberSets = await Promise.all(
    params.sourceListIds.map((id) => getMemberIds(db, id))
  );

  // Find intersection (members present in ALL lists)
  let intersection = memberSets[0] || [];
  for (let i = 1; i < memberSets.length; i++) {
    const currentSet = new Set(memberSets[i]);
    intersection = intersection.filter((id) => currentSet.has(id));
  }

  // Create derived list
  const [newList] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId: params.workspaceId,
      entityType: lists[0].entityType,
      type: 'derived',
      status: 'active',
      name: params.name,
      customFieldSchema: lists[0].customFieldSchema,
      parentListId: params.sourceListIds[0],
      totalContacts: intersection.length,
      activeContacts: intersection.length,
      enrichedContacts: 0,
      tags: [],
      metadata: {
        operation: 'intersect',
        sourceListIds: params.sourceListIds,
        sourceListNames: lists.map((l) => l.name),
      },
      createdBy: params.userId,
      updatedBy: params.userId,
      canBeRevived: true,
      revivalCount: 0,
    })
    .returning();

  // Add members
  if (intersection.length > 0) {
    await db.insert(schema.crmContactListMemberships).values(
      intersection.map((entityId) => ({
        workspaceId: params.workspaceId,
        listId: newList.id,
        entityType: lists[0].entityType,
        entityId,
        source: 'operation' as const,
        addedBy: params.userId,
        isActive: true,
        enrichmentData: {},
        metadata: { operation: 'intersect' },
        canBeRevived: true,
        revivalCount: 0,
        createdBy: params.userId,
      }))
    );
  }

  return { ...newList, memberCount: intersection.length };
}

/**
 * SPLIT: Segment by custom field value
 */
export async function split(
  db: Database,
  params: {
    workspaceId: string;
    sourceListId: string;
    fieldName: string;
    userId: string;
  }
) {
  const sourceList = await getList(db, params.sourceListId, params.workspaceId);

  // Get members with entity data for custom fields
  const { members } = await getListMembers(
    db,
    params.sourceListId,
    params.workspaceId,
    [] // No filters, get all
  );

  if (!members || !Array.isArray(members)) {
    throw new Error(`Failed to retrieve members for list ${params.sourceListId}`);
  }

  // Group by field value
  // Note: entity data from SQL query uses snake_case (custom_fields)
  const segments = new Map<string, string[]>();
  for (const member of members) {
    if (!member || !member.entity) continue;

    // Access custom_fields (snake_case from SQL)
    const customFields = (member.entity as any).custom_fields || member.entity.customFields;
    const value = customFields?.[params.fieldName];
    const key = value != null ? String(value) : 'null';

    if (!segments.has(key)) segments.set(key, []);
    segments.get(key)!.push(member.entityId);
  }

  // Create derived list for each segment
  const createdLists = [];
  for (const [value, entityIds] of segments) {
    const segmentName = `${sourceList.name} - ${params.fieldName}=${value}`;

    const [list] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId: params.workspaceId,
        entityType: sourceList.entityType,
        type: 'derived',
        status: 'active',
        name: segmentName,
        customFieldSchema: sourceList.customFieldSchema,
        parentListId: params.sourceListId,
        totalContacts: entityIds.length,
        activeContacts: entityIds.length,
        enrichedContacts: 0,
        tags: [],
        metadata: {
          operation: 'split',
          sourceListId: params.sourceListId,
          sourceListName: sourceList.name,
          fieldName: params.fieldName,
          fieldValue: value,
        },
        createdBy: params.userId,
        updatedBy: params.userId,
        canBeRevived: true,
        revivalCount: 0,
      })
      .returning();

    await db.insert(schema.crmContactListMemberships).values(
      entityIds.map((entityId) => ({
        workspaceId: params.workspaceId,
        listId: list.id,
        entityType: sourceList.entityType,
        entityId,
        source: 'operation' as const,
        addedBy: params.userId,
        isActive: true,
        enrichmentData: {},
        metadata: {
          operation: 'split',
          fieldName: params.fieldName,
          fieldValue: value,
        },
        canBeRevived: true,
        revivalCount: 0,
        createdBy: params.userId,
      }))
    );

    createdLists.push({ ...list, memberCount: entityIds.length });
  }

  return createdLists;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a list with validation
 */
async function getList(db: Database, listId: string, workspaceId: string) {
  const [list] = await db
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

  if (!list) {
    throw new Error(`List not found: ${listId}`);
  }

  return list;
}

/**
 * Get member entity IDs for a list
 */
async function getMemberIds(db: Database, listId: string): Promise<string[]> {
  const members = await db
    .select({ entityId: schema.crmContactListMemberships.entityId })
    .from(schema.crmContactListMemberships)
    .where(
      and(
        eq(schema.crmContactListMemberships.listId, listId),
        isNull(schema.crmContactListMemberships.deletedAt)
      )
    );

  return members.map((m) => m.entityId);
}

/**
 * CREATE FROM FILTERS: Create a new list from active custom field filters
 * Filters are applied to JSONB customFields column
 */
export async function createFromFilters(
  db: Database,
  params: {
    workspaceId: string;
    sourceListId: string;
    name: string;
    description?: string;
    filters: Record<string, any>;
    userId: string;
  }
) {
  // 1. Get source list to determine entity_type
  const sourceList = await getList(db, params.sourceListId, params.workspaceId);

  // 2. Get members matching filters
  // Build filter conditions for JSONB custom fields
  const filterConditions = [];
  for (const [field, value] of Object.entries(params.filters)) {
    if (value && value !== 'all' && value !== null && value !== undefined) {
      // Use JSONB ->> operator for text extraction and comparison
      filterConditions.push(
        sql`${schema.crmContactListMemberships.entityId} IN (
          SELECT ${getEntityTable(sourceList.entityType)}.id
          FROM ${getEntityTable(sourceList.entityType)}
          WHERE ${getEntityTable(sourceList.entityType)}.custom_fields->>${field} = ${value}
        )`
      );
    }
  }

  // 3. Query members with filters applied
  const whereClause = and(
    eq(schema.crmContactListMemberships.listId, params.sourceListId),
    eq(schema.crmContactListMemberships.entityType, sourceList.entityType),
    isNull(schema.crmContactListMemberships.deletedAt),
    ...(filterConditions.length > 0 ? filterConditions : [])
  );

  const filteredMembers = await db
    .select({ entityId: schema.crmContactListMemberships.entityId })
    .from(schema.crmContactListMemberships)
    .where(whereClause);

  const filteredEntityIds = filteredMembers.map((m) => m.entityId);

  // 4. Create new list with type="derived" and metadata
  const [newList] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId: params.workspaceId,
      entityType: sourceList.entityType,
      type: 'derived',
      status: 'active',
      name: params.name,
      description: params.description,
      customFieldSchema: sourceList.customFieldSchema,
      sourceListId: params.sourceListId, // Track original list
      parentListId: params.sourceListId,
      totalContacts: filteredEntityIds.length,
      activeContacts: filteredEntityIds.length,
      enrichedContacts: 0,
      tags: [],
      metadata: {
        operation: 'create_from_filters',
        filters: params.filters,
        sourceListId: params.sourceListId,
        sourceListName: sourceList.name,
        createdFrom: 'filters',
        filterAppliedAt: new Date().toISOString(),
      },
      createdBy: params.userId,
      updatedBy: params.userId,
      canBeRevived: true,
      revivalCount: 0,
    })
    .returning();

  // 5. Insert filtered members into new list
  if (filteredEntityIds.length > 0) {
    await db.insert(schema.crmContactListMemberships).values(
      filteredEntityIds.map((entityId) => ({
        workspaceId: params.workspaceId,
        listId: newList.id,
        entityType: sourceList.entityType,
        entityId,
        source: 'operation' as const,
        addedBy: params.userId,
        isActive: true,
        enrichmentData: {},
        metadata: {
          operation: 'create_from_filters',
          filters: params.filters,
        },
        canBeRevived: true,
        revivalCount: 0,
        createdBy: params.userId,
      }))
    );
  }

  return { ...newList, memberCount: filteredEntityIds.length };
}

/**
 * Get entity table reference based on entity type
 */
function getEntityTable(entityType: CrmEntityType) {
  switch (entityType) {
    case 'lead':
      return schema.crmLeads;
    case 'contact':
      return schema.crmContacts;
    case 'account':
      return schema.crmAccounts;
    case 'opportunity':
      return schema.crmOpportunities;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }
}

export const listOperationsService = {
  union,
  subtract,
  intersect,
  split,
  createFromFilters,
};
