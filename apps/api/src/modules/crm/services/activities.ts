/**
 * Activities Service
 * Business logic for task, call, meeting, and email tracking
 */

import type { Database } from '@agios/db';
import { crmActivities as activities, crmLeads } from '@agios/db';
import { eq, and, desc, lte, gte, isNull } from 'drizzle-orm';
import type { ActivityListFilters } from '../types';
import type { NewCrmActivity } from '@agios/db';
import { timelineService } from './timeline';

export const activityService = {
  async list(db: Database, filters: ActivityListFilters) {
    const conditions = [
      eq(activities.workspaceId, filters.workspaceId),
      isNull(activities.deletedAt), // Exclude soft deleted
    ];

    if (filters.assigneeId) {
      conditions.push(eq(activities.assigneeId, filters.assigneeId));
    }

    if (filters.status) {
      conditions.push(eq(activities.status, filters.status));
    }

    if (filters.type) {
      conditions.push(eq(activities.type, filters.type));
    }

    if (filters.contactId) {
      conditions.push(eq(activities.contactId, filters.contactId));
    }

    if (filters.accountId) {
      conditions.push(eq(activities.accountId, filters.accountId));
    }

    if (filters.opportunityId) {
      conditions.push(eq(activities.opportunityId, filters.opportunityId));
    }

    if (filters.leadId) {
      conditions.push(eq(activities.leadId, filters.leadId));
    }

    return db
      .select()
      .from(activities)
      .where(and(...conditions))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .orderBy(desc(activities.createdAt));
  },

  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.id, id),
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt) // Exclude soft deleted
        )
      );
    return results[0] || null;
  },

  async create(db: Database, data: NewCrmActivity) {
    const [activity] = await db.insert(activities).values(data).returning();

    // Create timeline event if entity is linked
    const entityId = data.contactId || data.accountId || data.opportunityId || data.leadId;
    if (entityId) {
      const entityType = data.contactId ? 'contact' : data.accountId ? 'account' : data.opportunityId ? 'opportunity' : 'lead';

      await timelineService.create(db, {
        workspaceId: data.workspaceId,
        entityType: entityType as any,
        entityId,
        eventType: 'activity.created',
        eventCategory: 'communication',
        eventLabel: `${data.type} Scheduled`,
        summary: `${data.type}: ${data.subject}`,
        description: data.description,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: data.createdBy,
      });
    }

    return activity;
  },

  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmActivity>) {
    // Get original to track status changes
    const original = await this.getById(db, id, workspaceId);
    if (!original) return null;

    const updateData = { ...data, updatedAt: new Date() };

    // Auto-set completedDate when status changes to completed
    if (data.status === 'completed' && !data.completedDate) {
      updateData.completedDate = new Date();
    }

    const [updated] = await db
      .update(activities)
      .set(updateData)
      .where(
        and(
          eq(activities.id, id),
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt) // Only update if not soft deleted
        )
      )
      .returning();

    if (!updated) return null;

    // Create timeline event when activity is completed
    if (data.status === 'completed' && original.status !== 'completed') {
      // Determine entity type and ID for polymorphic relationship
      const entityType = updated.contactId ? 'contact' : updated.accountId ? 'account' : updated.opportunityId ? 'opportunity' : 'lead';
      const entityId = (updated.contactId || updated.accountId || updated.opportunityId || updated.leadId)!;

      await timelineService.create(db, {
        workspaceId,
        entityType: entityType as any,
        entityId,
        eventType: 'activity.completed',
        eventCategory: 'communication',
        eventLabel: `${updated.type} Completed`,
        summary: `${updated.type}: ${updated.subject}`,
        description: updated.description,
        occurredAt: updated.completedDate || new Date(),
        actorType: 'user',
        actorId: data.updatedBy,
        communication: {
          channel: updated.type,
          outcome: updated.outcome,
          duration: updated.duration,
        },
      });
    }

    // Create timeline event when activity is cancelled
    if (data.status === 'cancelled' && original.status !== 'cancelled') {
      const entityType = updated.contactId ? 'contact' : updated.accountId ? 'account' : updated.opportunityId ? 'opportunity' : 'lead';
      const entityId = (updated.contactId || updated.accountId || updated.opportunityId || updated.leadId)!;

      await timelineService.create(db, {
        workspaceId,
        entityType: entityType as any,
        entityId,
        eventType: 'activity.cancelled',
        eventCategory: 'communication',
        eventLabel: `${updated.type} Cancelled`,
        summary: `${updated.type}: ${updated.subject}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: data.updatedBy,
      });
    }

    // Create timeline event when due date changes (rescheduled)
    if (data.dueDate && original.dueDate && data.dueDate !== original.dueDate) {
      const entityType = updated.contactId ? 'contact' : updated.accountId ? 'account' : updated.opportunityId ? 'opportunity' : 'lead';
      const entityId = (updated.contactId || updated.accountId || updated.opportunityId || updated.leadId)!;

      await timelineService.create(db, {
        workspaceId,
        entityType: entityType as any,
        entityId,
        eventType: 'activity.rescheduled',
        eventCategory: 'communication',
        eventLabel: `${updated.type} Rescheduled`,
        summary: `${updated.type}: ${updated.subject} rescheduled`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: data.updatedBy,
        dataChanges: {
          field: 'dueDate',
          oldValue: original.dueDate,
          newValue: data.dueDate,
        },
      });
    }

    return updated;
  },

  async delete(db: Database, id: string, workspaceId: string, userId?: string) {
    // Soft delete: set deletedAt timestamp instead of hard delete
    const [deleted] = await db
      .update(activities)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(activities.id, id),
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt) // Only delete if not already deleted
        )
      )
      .returning();

    if (deleted && userId) {
      // Create timeline event
      const entityType = deleted.contactId ? 'contact' : deleted.accountId ? 'account' : deleted.opportunityId ? 'opportunity' : 'lead';
      const entityId = (deleted.contactId || deleted.accountId || deleted.opportunityId || deleted.leadId)!;

      await timelineService.create(db, {
        workspaceId,
        entityType: entityType as any,
        entityId,
        eventType: 'activity.deleted',
        eventCategory: 'system',
        eventLabel: `${deleted.type} Deleted`,
        summary: `${deleted.type}: ${deleted.subject} was deleted`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId,
      });
    }

    return deleted || null;
  },

  async getByContact(db: Database, contactId: string, workspaceId: string) {
    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.contactId, contactId),
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt) // Exclude soft deleted
        )
      )
      .orderBy(desc(activities.createdAt));
  },

  async getByAccount(db: Database, accountId: string, workspaceId: string) {
    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.accountId, accountId),
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt) // Exclude soft deleted
        )
      )
      .orderBy(desc(activities.createdAt));
  },

  async getByOpportunity(db: Database, opportunityId: string, workspaceId: string) {
    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.opportunityId, opportunityId),
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt) // Exclude soft deleted
        )
      )
      .orderBy(desc(activities.createdAt));
  },

  async getOverdue(db: Database, assigneeId: string, workspaceId: string) {
    const now = new Date();
    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.workspaceId, workspaceId),
          eq(activities.assigneeId, assigneeId),
          eq(activities.status, 'planned'),
          lte(activities.dueDate, now),
          isNull(activities.deletedAt) // Exclude soft deleted
        )
      )
      .orderBy(desc(activities.dueDate));
  },

  async getRecent(db: Database, workspaceId: string, seconds: number) {
    const since = new Date(Date.now() - seconds * 1000);
    const results = await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.workspaceId, workspaceId),
          isNull(activities.deletedAt), // Exclude soft deleted
          gte(activities.createdAt, since)
        )
      )
      .orderBy(desc(activities.createdAt));
    return results;
  },

  /**
   * Log call disposition and update lead status based on disposition rules
   * This is the agent-facing API for quick call logging after calls
   */
  async logCallDisposition(
    db: Database,
    data: {
      workspaceId: string;
      leadId: string;
      disposition: 'ntu' | 'rpc_interested' | 'rpc_not_interested' | 'callback_scheduled' | 'wpc' | 'npc';
      notes?: string;
      callbackDate?: Date;
      duration?: number;
      userId: string;
    }
  ) {
    // Disposition rules define how each disposition affects lead status
    const dispositionRules = {
      ntu: {
        leadStatus: 'contacted' as const,
        nextAction: 'callback',
        priority: 'medium' as const,
      },
      rpc_interested: {
        leadStatus: 'qualified' as const,
        nextAction: 'demo',
        priority: 'high' as const,
      },
      rpc_not_interested: {
        leadStatus: 'unqualified' as const,
        nextAction: null,
        priority: 'low' as const,
      },
      callback_scheduled: {
        leadStatus: 'contacted' as const,
        nextAction: 'callback',
        priority: 'high' as const,
      },
      wpc: {
        leadStatus: 'contacted' as const,
        nextAction: 'research',
        priority: 'low' as const,
      },
      npc: {
        leadStatus: 'contacted' as const,
        nextAction: 'callback',
        priority: 'medium' as const,
      },
    };

    const rule = dispositionRules[data.disposition];

    // Validation: callback_scheduled requires callbackDate
    if (data.disposition === 'callback_scheduled' && !data.callbackDate) {
      throw new Error('CALLBACK_DATE_REQUIRED');
    }

    // Validation: notes max 500 chars
    if (data.notes && data.notes.length > 500) {
      throw new Error('NOTES_TOO_LONG');
    }

    const startTime = Date.now();

    // Create activity with disposition
    const [activity] = await db
      .insert(activities)
      .values({
        workspaceId: data.workspaceId,
        leadId: data.leadId,
        type: 'call',
        subject: `Call - ${data.disposition.toUpperCase()}`,
        description: data.notes,
        disposition: data.disposition,
        duration: data.duration,
        status: 'completed',
        completedDate: new Date(),
        assigneeId: data.userId,
        createdBy: data.userId,
        updatedBy: data.userId,
        priority: rule.priority,
        metadata: {
          nextAction: rule.nextAction,
        },
      })
      .returning();

    // Update lead status and callback date
    const leadUpdateData: any = {
      status: rule.leadStatus,
      lastContactDate: new Date(),
      updatedAt: new Date(),
      updatedBy: data.userId,
    };

    // Set callback date if disposition is callback_scheduled
    if (data.disposition === 'callback_scheduled' && data.callbackDate) {
      leadUpdateData.callbackDate = data.callbackDate;
    }

    const [updatedLead] = await db
      .update(crmLeads)
      .set(leadUpdateData)
      .where(
        and(eq(crmLeads.id, data.leadId), eq(crmLeads.workspaceId, data.workspaceId))
      )
      .returning();

    if (!updatedLead) {
      throw new Error('LEAD_NOT_FOUND');
    }

    // Create timeline event
    await timelineService.create(db, {
      workspaceId: data.workspaceId,
      entityType: 'lead',
      entityId: data.leadId,
      eventType: 'activity.call_disposition',
      eventCategory: 'communication',
      eventLabel: `Call Disposition: ${data.disposition.toUpperCase()}`,
      summary: `Call logged with disposition: ${data.disposition}`,
      description: data.notes,
      occurredAt: new Date(),
      actorType: 'user',
      actorId: data.userId,
      communication: {
        channel: 'call',
        disposition: data.disposition,
        duration: data.duration,
        outcome: rule.nextAction,
      },
    });

    const elapsed = Date.now() - startTime;

    return {
      activity,
      lead: updatedLead,
      performance: {
        saveTime: elapsed,
        withinSLA: elapsed < 300, // <300ms requirement
      },
    };
  },
};
