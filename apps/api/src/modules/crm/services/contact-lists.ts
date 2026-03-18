/**
 * Contact Lists Service
 * Business logic for contact list CRUD operations
 */

import type { Database } from '@agios/db';
import { crmContactLists, crmContactListMemberships, crmContacts, crmLeads, crmAccounts, crmEnrichmentJobs, crmEnrichmentResults } from '@agios/db';
import { eq, and, desc, isNull, sql, inArray, gte, sum, ne } from 'drizzle-orm';
import type { NewCrmContactList, NewCrmContactListMembership } from '@agios/db';

export const contactListService = {
  /**
   * Check if a list name already exists in the workspace (case-insensitive)
   * @param excludeListId - Optional list ID to exclude from check (for updates)
   * @returns true if duplicate exists, false otherwise
   */
  async checkDuplicateListName(
    db: Database,
    workspaceId: string,
    name: string,
    excludeListId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(crmContactLists.workspaceId, workspaceId),
      sql`LOWER(${crmContactLists.name}) = LOWER(${name})`,
      isNull(crmContactLists.deletedAt),
    ];

    // Exclude the current list ID when updating
    if (excludeListId) {
      conditions.push(ne(crmContactLists.id, excludeListId));
    }

    const results = await db
      .select({ id: crmContactLists.id })
      .from(crmContactLists)
      .where(and(...conditions))
      .limit(1);

    return results.length > 0;
  },

  /**
   * Create a new contact list
   */
  async create(db: Database, data: NewCrmContactList) {
    const results = await db.insert(crmContactLists).values(data).returning();
    return results[0];
  },

  /**
   * List all contact lists for a workspace (excluding soft deleted)
   */
  async list(db: Database, workspaceId: string) {
    const results = await db
      .select()
      .from(crmContactLists)
      .where(
        and(
          eq(crmContactLists.workspaceId, workspaceId),
          isNull(crmContactLists.deletedAt) // Exclude soft deleted
        )
      )
      .orderBy(desc(crmContactLists.createdAt));

    return results;
  },

  /**
   * Get total enrichment spend for a list
   */
  async getTotalSpendForList(db: Database, listId: string): Promise<number> {
    const results = await db
      .select({ totalCost: sum(crmEnrichmentResults.cost) })
      .from(crmEnrichmentResults)
      .innerJoin(
        crmEnrichmentJobs,
        eq(crmEnrichmentResults.jobId, crmEnrichmentJobs.id)
      )
      .where(
        and(
          eq(crmEnrichmentJobs.sourceListId, listId),
          eq(crmEnrichmentResults.status, 'success')
        )
      );

    const totalCost = results[0]?.totalCost;
    return totalCost ? Number(totalCost) : 0;
  },

  /**
   * Get a single contact list by ID with workspace isolation
   * Returns list with budget information
   */
  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmContactLists)
      .where(
        and(
          eq(crmContactLists.id, id),
          eq(crmContactLists.workspaceId, workspaceId),
          isNull(crmContactLists.deletedAt)
        )
      );

    const list = results[0] || null;
    if (!list) return null;

    // Enrich with budget status
    const totalSpent = await this.getTotalSpendForList(db, id);
    const budgetLimit = list.budgetLimit ? Number(list.budgetLimit) : null;
    const budgetRemaining = budgetLimit ? Math.max(0, budgetLimit - totalSpent) : null;

    return {
      ...list,
      totalSpent,
      budgetRemaining,
    };
  },

  /**
   * Update a contact list
   */
  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmContactList>) {
    const results = await db
      .update(crmContactLists)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmContactLists.id, id),
          eq(crmContactLists.workspaceId, workspaceId),
          isNull(crmContactLists.deletedAt)
        )
      )
      .returning();

    return results[0] || null;
  },

  /**
   * Soft delete a contact list
   */
  async softDelete(db: Database, id: string, workspaceId: string) {
    const results = await db
      .update(crmContactLists)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmContactLists.id, id),
          eq(crmContactLists.workspaceId, workspaceId),
          isNull(crmContactLists.deletedAt)
        )
      )
      .returning();

    return results[0] || null;
  },

  /**
   * Add contacts to a list in bulk (idempotent)
   * Uses onConflictDoNothing for idempotency
   */
  async addContacts(
    db: Database,
    listId: string,
    workspaceId: string,
    contactIds: string[],
    source: 'manual' | 'import' | 'campaign' | 'enrichment' | 'segment' | 'api',
    userId: string
  ) {
    // Verify list exists and belongs to workspace
    const list = await this.getById(db, listId, workspaceId);
    if (!list) {
      throw new Error('List not found or access denied');
    }

    // Verify all contacts exist and belong to workspace
    const contacts = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(
        and(
          inArray(crmContacts.id, contactIds),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt)
        )
      );

    if (contacts.length !== contactIds.length) {
      throw new Error('Some contacts not found or access denied');
    }

    // Prepare membership records
    const memberships: NewCrmContactListMembership[] = contactIds.map((contactId) => ({
      workspaceId,
      listId,
      contactId,
      source,
      addedBy: userId,
      createdBy: userId,
      updatedBy: userId,
    }));

    // Insert with conflict handling (idempotent)
    const results = await db
      .insert(crmContactListMemberships)
      .values(memberships)
      .onConflictDoNothing({ target: [crmContactListMemberships.listId, crmContactListMemberships.contactId] })
      .returning();

    // Update cached count
    await this.updateListContactCount(db, listId);

    return results;
  },

  /**
   * Remove a contact from a list
   */
  async removeContact(db: Database, listId: string, contactId: string, workspaceId: string) {
    // Soft delete the membership
    const results = await db
      .update(crmContactListMemberships)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmContactListMemberships.listId, listId),
          eq(crmContactListMemberships.contactId, contactId),
          eq(crmContactListMemberships.workspaceId, workspaceId),
          isNull(crmContactListMemberships.deletedAt)
        )
      )
      .returning();

    // Update cached count
    if (results.length > 0) {
      await this.updateListContactCount(db, listId);
    }

    return results[0] || null;
  },

  /**
   * Get all members of a list
   */
  async getMembers(db: Database, listId: string, workspaceId: string) {
    const results = await db
      .select({
        membership: crmContactListMemberships,
        contact: crmContacts,
      })
      .from(crmContactListMemberships)
      .innerJoin(
        crmContacts,
        eq(crmContactListMemberships.contactId, crmContacts.id)
      )
      .where(
        and(
          eq(crmContactListMemberships.listId, listId),
          eq(crmContactListMemberships.workspaceId, workspaceId),
          isNull(crmContactListMemberships.deletedAt),
          isNull(crmContacts.deletedAt)
        )
      )
      .orderBy(desc(crmContactListMemberships.addedAt));

    return results;
  },

  /**
   * Update cached contact count for a list
   * Counts only non-deleted memberships
   */
  async updateListContactCount(db: Database, listId: string) {
    // Count active memberships
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmContactListMemberships)
      .where(
        and(
          eq(crmContactListMemberships.listId, listId),
          isNull(crmContactListMemberships.deletedAt)
        )
      );

    const totalContacts = Number(countResult[0]?.count || 0);

    // Update list
    await db
      .update(crmContactLists)
      .set({
        totalContacts,
        updatedAt: new Date(),
      })
      .where(eq(crmContactLists.id, listId));

    return totalContacts;
  },

  /**
   * Get recent contact lists (for CQRS pattern)
   */
  async getRecent(db: Database, workspaceId: string, seconds: number) {
    const since = new Date(Date.now() - seconds * 1000);
    const results = await db
      .select()
      .from(crmContactLists)
      .where(
        and(
          eq(crmContactLists.workspaceId, workspaceId),
          isNull(crmContactLists.deletedAt),
          gte(crmContactLists.createdAt, since)
        )
      )
      .orderBy(desc(crmContactLists.createdAt));

    return results;
  },

  /**
   * Analyze custom fields from list members
   * Returns field names, types, unique value counts, and sample values
   */
  async getCustomFieldSchema(db: Database, listId: string, workspaceId: string) {
    // Verify list exists and get entity type
    const list = await this.getById(db, listId, workspaceId);
    if (!list) {
      return null;
    }

    // Determine which entity table to join based on list's entity_type
    const entityType = list.entityType || 'contact'; // Default to contact for backwards compatibility

    let members: Array<{ entity: any; customFields: any }> = [];

    if (entityType === 'lead') {
      members = await db
        .select({
          entity: crmLeads,
          customFields: crmLeads.customFields,
        })
        .from(crmContactListMemberships)
        .innerJoin(
          crmLeads,
          eq(crmContactListMemberships.entityId, crmLeads.id)
        )
        .where(
          and(
            eq(crmContactListMemberships.listId, listId),
            eq(crmContactListMemberships.workspaceId, workspaceId),
            eq(crmContactListMemberships.entityType, 'lead'),
            isNull(crmContactListMemberships.deletedAt),
            isNull(crmLeads.deletedAt)
          )
        )
        .limit(1000);
    } else if (entityType === 'account') {
      members = await db
        .select({
          entity: crmAccounts,
          customFields: crmAccounts.customFields,
        })
        .from(crmContactListMemberships)
        .innerJoin(
          crmAccounts,
          eq(crmContactListMemberships.entityId, crmAccounts.id)
        )
        .where(
          and(
            eq(crmContactListMemberships.listId, listId),
            eq(crmContactListMemberships.workspaceId, workspaceId),
            eq(crmContactListMemberships.entityType, 'account'),
            isNull(crmContactListMemberships.deletedAt),
            isNull(crmAccounts.deletedAt)
          )
        )
        .limit(1000);
    } else {
      // Default to contact
      members = await db
        .select({
          entity: crmContacts,
          customFields: crmContacts.customFields,
        })
        .from(crmContactListMemberships)
        .innerJoin(
          crmContacts,
          eq(crmContactListMemberships.entityId, crmContacts.id)
        )
        .where(
          and(
            eq(crmContactListMemberships.listId, listId),
            eq(crmContactListMemberships.workspaceId, workspaceId),
            eq(crmContactListMemberships.entityType, 'contact'),
            isNull(crmContactListMemberships.deletedAt),
            isNull(crmContacts.deletedAt)
          )
        )
        .limit(1000);
    }

    // Analyze both standard fields and custom fields
    const fieldAnalysis = this.analyzeAllFields(members, entityType);

    return {
      fields: fieldAnalysis,
      totalMembers: members.length,
      sampled: members.length === 1000,
    };
  },

  /**
   * Helper: Analyze all fields (standard + custom) from member data
   * Returns field metadata including type, unique values, and samples
   */
  analyzeAllFields(
    members: Array<{ entity: any; customFields: any }>,
    entityType: string
  ): Array<{
    name: string;
    type: string;
    uniqueValues: number;
    sampleValues: string[];
  }> {
    const fieldMap = new Map<
      string,
      {
        values: Set<any>;
        type: string;
      }
    >();

    // Define standard fields to include based on entity type
    const standardFieldsToInclude: Record<string, string[]> = {
      lead: ['status', 'source'],
      contact: ['status', 'source', 'lifecycleStage'],
      account: ['status', 'industry', 'accountType'],
    };

    const fieldsToInclude = standardFieldsToInclude[entityType] || [];

    // Collect standard field values
    for (const member of members) {
      if (!member.entity) continue;

      for (const fieldName of fieldsToInclude) {
        const value = member.entity[fieldName];
        if (value === null || value === undefined) continue;

        if (!fieldMap.has(fieldName)) {
          fieldMap.set(fieldName, {
            values: new Set(),
            type: typeof value,
          });
        }

        fieldMap.get(fieldName)!.values.add(value);
      }
    }

    // Collect custom field values from JSONB
    for (const member of members) {
      if (!member.customFields || typeof member.customFields !== 'object') {
        continue;
      }

      for (const [key, value] of Object.entries(member.customFields)) {
        if (value === null || value === undefined) {
          continue;
        }

        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            values: new Set(),
            type: typeof value,
          });
        }

        fieldMap.get(key)!.values.add(value);
      }
    }

    // Convert to result format
    const results = Array.from(fieldMap.entries())
      .map(([name, data]) => ({
        name,
        type:
          data.type === 'number'
            ? 'Number'
            : data.type === 'boolean'
            ? 'Boolean'
            : 'String',
        uniqueValues: data.values.size,
        sampleValues: Array.from(data.values)
          .slice(0, 20)
          .map((v) => String(v)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return results;
  },

  /**
   * Helper: Analyze custom fields from member data
   * Returns field metadata including type, unique values, and samples
   */
  analyzeCustomFields(
    members: Array<{ customFields: any }>
  ): Array<{
    name: string;
    type: string;
    uniqueValues: number;
    sampleValues: string[];
  }> {
    const fieldMap = new Map<
      string,
      {
        values: Set<any>;
        type: string;
      }
    >();

    // Collect all field values
    for (const member of members) {
      if (!member.customFields || typeof member.customFields !== 'object') {
        continue;
      }

      for (const [key, value] of Object.entries(member.customFields)) {
        if (value === null || value === undefined) {
          continue;
        }

        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            values: new Set(),
            type: typeof value,
          });
        }

        fieldMap.get(key)!.values.add(value);
      }
    }

    // Convert to result format
    const results = Array.from(fieldMap.entries())
      .map(([name, data]) => ({
        name,
        type:
          data.type === 'number'
            ? 'Number'
            : data.type === 'boolean'
            ? 'Boolean'
            : 'String',
        uniqueValues: data.values.size,
        sampleValues: Array.from(data.values)
          .slice(0, 20)
          .map((v) => String(v)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return results;
  },
};
