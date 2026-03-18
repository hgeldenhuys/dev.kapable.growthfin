/**
 * Timeline Service
 * Business logic for CRM timeline events
 */

import type { Database } from '@agios/db';
import { crmTimelineEvents } from '@agios/db';
import { eq, and, desc, gte, lte, isNull } from 'drizzle-orm';
import type { TimelineListFilters, NewCRMTimelineEvent } from '../types';

export const timelineService = {
  async list(db: Database, filters: TimelineListFilters) {
    const conditions = [
      eq(crmTimelineEvents.workspaceId, filters.workspaceId),
      isNull(crmTimelineEvents.deletedAt),
    ];

    if (filters.entityType) {
      conditions.push(eq(crmTimelineEvents.entityType, filters.entityType as any));
    }

    if (filters.entityId) {
      conditions.push(eq(crmTimelineEvents.entityId, filters.entityId));
    }

    if (filters.eventType) {
      conditions.push(eq(crmTimelineEvents.eventType, filters.eventType));
    }

    if (filters.eventCategory) {
      conditions.push(eq(crmTimelineEvents.eventCategory, filters.eventCategory as any));
    }

    if (filters.startDate) {
      conditions.push(gte(crmTimelineEvents.occurredAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(crmTimelineEvents.occurredAt, filters.endDate));
    }

    return db
      .select()
      .from(crmTimelineEvents)
      .where(and(...conditions))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .orderBy(desc(crmTimelineEvents.isPinned), desc(crmTimelineEvents.occurredAt));
  },

  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmTimelineEvents)
      .where(and(eq(crmTimelineEvents.id, id), eq(crmTimelineEvents.workspaceId, workspaceId)));
    return results[0] || null;
  },

  async create(db: Database, data: NewCRMTimelineEvent) {
    // Default occurredAt to now if not provided
    const eventData = {
      ...data,
      occurredAt: data.occurredAt || new Date(),
    };
    const results = await db.insert(crmTimelineEvents).values(eventData).returning();
    return results[0];
  },

  async pin(db: Database, id: string, workspaceId: string, userId: string) {
    const results = await db
      .update(crmTimelineEvents)
      .set({
        isPinned: true,
        pinnedBy: userId,
        pinnedAt: new Date(),
      })
      .where(
        and(
          eq(crmTimelineEvents.id, id),
          eq(crmTimelineEvents.workspaceId, workspaceId),
          isNull(crmTimelineEvents.deletedAt)
        )
      )
      .returning();

    if (results.length === 0) {
      throw new Error('Timeline event not found');
    }

    return results[0];
  },

  async unpin(db: Database, id: string, workspaceId: string) {
    const results = await db
      .update(crmTimelineEvents)
      .set({
        isPinned: false,
        pinnedBy: null,
        pinnedAt: null,
      })
      .where(
        and(
          eq(crmTimelineEvents.id, id),
          eq(crmTimelineEvents.workspaceId, workspaceId),
          isNull(crmTimelineEvents.deletedAt)
        )
      )
      .returning();

    if (results.length === 0) {
      throw new Error('Timeline event not found');
    }

    return results[0];
  },

  async getByEntity(db: Database, entityType: string, entityId: string, workspaceId: string, limit = 50) {
    return db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.workspaceId, workspaceId),
          eq(crmTimelineEvents.entityType, entityType as any),
          eq(crmTimelineEvents.entityId, entityId),
          isNull(crmTimelineEvents.deletedAt)
        )
      )
      .limit(limit)
      .orderBy(desc(crmTimelineEvents.isPinned), desc(crmTimelineEvents.occurredAt));
  },

  async getRecent(db: Database, workspaceId: string, seconds: number, entityType?: string, entityId?: string) {
    const since = new Date(Date.now() - seconds * 1000);
    const conditions = [
      eq(crmTimelineEvents.workspaceId, workspaceId),
      gte(crmTimelineEvents.occurredAt, since),
      isNull(crmTimelineEvents.deletedAt),
    ];

    if (entityType) {
      conditions.push(eq(crmTimelineEvents.entityType, entityType as any));
    }

    if (entityId) {
      conditions.push(eq(crmTimelineEvents.entityId, entityId));
    }

    const results = await db
      .select()
      .from(crmTimelineEvents)
      .where(and(...conditions))
      .orderBy(desc(crmTimelineEvents.isPinned), desc(crmTimelineEvents.occurredAt));
    return results;
  },
};
