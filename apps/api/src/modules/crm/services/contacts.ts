/**
 * Contacts Service
 * Business logic for contact operations
 */

import type { Database } from '@agios/db';
import { crmContacts } from '@agios/db';
import { eq, and, desc, or, ilike, gte, isNull, sql } from 'drizzle-orm';
import type { ContactListFilters } from '../types';
import type { NewCrmContact } from '@agios/db';

export const contactService = {
  async list(db: Database, filters: ContactListFilters) {
    // Apply filters - exclude soft deleted records
    const conditions = [
      eq(crmContacts.workspaceId, filters.workspaceId),
      isNull(crmContacts.deletedAt), // Exclude soft deleted
    ];

    if (filters.status) {
      conditions.push(eq(crmContacts.status, filters.status));
    }

    if (filters.lifecycleStage) {
      conditions.push(eq(crmContacts.lifecycleStage, filters.lifecycleStage));
    }

    if (filters.ownerId) {
      conditions.push(eq(crmContacts.ownerId, filters.ownerId));
    }

    if (filters.accountId) {
      conditions.push(eq(crmContacts.accountId, filters.accountId));
    }

    // Custom field filtering
    if (filters.customFieldFilters) {
      for (const [fieldName, fieldValue] of Object.entries(filters.customFieldFilters)) {
        // Sanitize field name to prevent SQL injection
        const sanitizedFieldName = fieldName.replace(/[^a-zA-Z0-9_]/g, '');

        if (fieldValue !== null && fieldValue !== undefined) {
          // Escape single quotes in value
          const escapedValue = String(fieldValue).replace(/'/g, "''");

          // Add custom field filter using JSONB operator
          // This uses the GIN index on custom_fields column
          conditions.push(
            sql.raw(`custom_fields->>'${sanitizedFieldName}' = '${escapedValue}'`)
          );
        }
      }
    }

    // Apply pagination with defaults and max limit
    const limit = Math.min(filters.limit || 50, 100); // Default 50, max 100
    const offset = filters.offset || 0;

    // Base condition (workspace + not deleted) for unfiltered stats
    const baseCondition = and(
      eq(crmContacts.workspaceId, filters.workspaceId),
      isNull(crmContacts.deletedAt)
    );

    // Get filtered count, paginated results, and unfiltered stats in parallel
    const [countResult, contacts, statusCounts, lifecycleCounts] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(crmContacts)
        .where(and(...conditions)),
      db
        .select()
        .from(crmContacts)
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(crmContacts.createdAt)),
      db
        .select({ status: crmContacts.status, count: sql<number>`count(*)::int` })
        .from(crmContacts)
        .where(baseCondition!)
        .groupBy(crmContacts.status),
      db
        .select({ lifecycleStage: crmContacts.lifecycleStage, count: sql<number>`count(*)::int` })
        .from(crmContacts)
        .where(baseCondition!)
        .groupBy(crmContacts.lifecycleStage),
    ]);

    const total = countResult[0]?.count || 0;

    // Calculate page number (1-based)
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    // Build stats from DB aggregates
    const statusMap: Record<string, number> = {};
    let allTotal = 0;
    for (const row of statusCounts) {
      statusMap[row.status ?? 'unknown'] = row.count;
      allTotal += row.count;
    }
    const lifecycleMap: Record<string, number> = {};
    for (const row of lifecycleCounts) {
      lifecycleMap[row.lifecycleStage ?? 'unknown'] = row.count;
    }

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        total: allTotal,
        active: statusMap['active'] ?? 0,
        customers: lifecycleMap['customer'] ?? 0,
        prospects: lifecycleMap['prospect'] ?? 0,
      },
    };
  },

  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, id),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt) // Exclude soft deleted
        )
      );
    return results[0] || null;
  },

  async create(db: Database, data: NewCrmContact) {
    const results = await db.insert(crmContacts).values(data).returning();
    return results[0];
  },

  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmContact>) {
    const results = await db
      .update(crmContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmContacts.id, id),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt) // Only update if not soft deleted
        )
      )
      .returning();
    return results[0] || null;
  },

  async delete(db: Database, id: string, workspaceId: string) {
    // Soft delete: set deletedAt timestamp instead of hard delete
    const results = await db
      .update(crmContacts)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmContacts.id, id),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt) // Only delete if not already deleted
        )
      )
      .returning();
    return results[0] || null;
  },

  async search(db: Database, workspaceId: string, query: string, limit = 50) {
    const searchPattern = `%${query}%`;
    const results = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt), // Exclude soft deleted
          or(
            ilike(crmContacts.firstName, searchPattern),
            ilike(crmContacts.lastName, searchPattern),
            ilike(crmContacts.email, searchPattern)
          )
        )
      )
      .limit(limit)
      .orderBy(desc(crmContacts.createdAt));
    return results;
  },

  async getRecent(db: Database, workspaceId: string, seconds: number) {
    const since = new Date(Date.now() - seconds * 1000);
    const results = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt), // Exclude soft deleted
          gte(crmContacts.createdAt, since)
        )
      )
      .orderBy(desc(crmContacts.createdAt));
    return results;
  },
};
