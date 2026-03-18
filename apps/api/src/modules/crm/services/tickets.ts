/**
 * Ticket Service
 * CRUD operations for support tickets and product feedback
 */

import type { Database } from '@agios/db';
import { crmTickets, crmTicketComments } from '@agios/db';
import { eq, and, desc, or, ilike, isNull, sql, count } from 'drizzle-orm';
import type { NewCrmTicket, NewCrmTicketComment } from '@agios/db';

export interface TicketListFilters {
  workspaceId: string;
  status?: string;
  category?: string;
  priority?: string;
  assigneeId?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const ticketService = {
  /**
   * List tickets with filtering and pagination
   */
  async list(db: Database, filters: TicketListFilters) {
    const conditions: any[] = [
      eq(crmTickets.workspaceId, filters.workspaceId),
      isNull(crmTickets.deletedAt),
    ];

    if (filters.status) conditions.push(eq(crmTickets.status, filters.status as any));
    if (filters.category) conditions.push(eq(crmTickets.category, filters.category as any));
    if (filters.priority) conditions.push(eq(crmTickets.priority, filters.priority as any));
    if (filters.assigneeId) conditions.push(eq(crmTickets.assigneeId, filters.assigneeId));
    if (filters.entityType) conditions.push(eq(crmTickets.entityType, filters.entityType as any));
    if (filters.entityId) conditions.push(eq(crmTickets.entityId, filters.entityId));
    if (filters.search) {
      conditions.push(
        or(
          ilike(crmTickets.title, `%${filters.search}%`),
          ilike(crmTickets.description, `%${filters.search}%`)
        )
      );
    }

    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmTickets)
      .where(and(...conditions));

    const records = await db
      .select()
      .from(crmTickets)
      .where(and(...conditions))
      .orderBy(desc(crmTickets.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      records,
      total: countResult.count,
      limit,
      offset,
    };
  },

  /**
   * Get a single ticket by ID
   */
  async getById(db: Database, id: string, workspaceId: string) {
    const [ticket] = await db
      .select()
      .from(crmTickets)
      .where(
        and(
          eq(crmTickets.id, id),
          eq(crmTickets.workspaceId, workspaceId),
          isNull(crmTickets.deletedAt)
        )
      );
    return ticket || null;
  },

  /**
   * Create a new ticket
   */
  async create(db: Database, data: NewCrmTicket) {
    const results = await db.insert(crmTickets).values(data).returning();
    return results[0];
  },

  /**
   * Update an existing ticket
   */
  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmTicket>) {
    const results = await db
      .update(crmTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmTickets.id, id),
          eq(crmTickets.workspaceId, workspaceId),
          isNull(crmTickets.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Soft delete a ticket
   */
  async delete(db: Database, id: string, workspaceId: string) {
    const results = await db
      .update(crmTickets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(crmTickets.id, id),
          eq(crmTickets.workspaceId, workspaceId),
          isNull(crmTickets.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Search tickets by title and description (ILIKE)
   */
  async search(db: Database, workspaceId: string, query: string, limit = 20) {
    const records = await db
      .select()
      .from(crmTickets)
      .where(
        and(
          eq(crmTickets.workspaceId, workspaceId),
          isNull(crmTickets.deletedAt),
          or(
            ilike(crmTickets.title, `%${query}%`),
            ilike(crmTickets.description, `%${query}%`)
          )
        )
      )
      .orderBy(desc(crmTickets.createdAt))
      .limit(limit);

    return records;
  },

  /**
   * Get ticket summary/stats for a workspace
   */
  async summary(db: Database, workspaceId: string) {
    const base = and(eq(crmTickets.workspaceId, workspaceId), isNull(crmTickets.deletedAt));

    const [totals] = await db
      .select({ total: count() })
      .from(crmTickets)
      .where(base);

    const byStatus = await db
      .select({ status: crmTickets.status, count: count() })
      .from(crmTickets)
      .where(base)
      .groupBy(crmTickets.status);

    const byCategory = await db
      .select({ category: crmTickets.category, count: count() })
      .from(crmTickets)
      .where(base)
      .groupBy(crmTickets.category);

    const byPriority = await db
      .select({ priority: crmTickets.priority, count: count() })
      .from(crmTickets)
      .where(base)
      .groupBy(crmTickets.priority);

    // Open tickets count
    const [openCount] = await db
      .select({ count: count() })
      .from(crmTickets)
      .where(
        and(
          base,
          or(
            eq(crmTickets.status, 'open'),
            eq(crmTickets.status, 'in_progress'),
            eq(crmTickets.status, 'waiting')
          )
        )
      );

    // Average resolution time (for resolved/closed tickets)
    const [avgResolution] = await db
      .select({
        avgHours: sql<number>`ROUND(AVG(EXTRACT(EPOCH FROM (${crmTickets.updatedAt} - ${crmTickets.createdAt})) / 3600)::numeric, 1)`,
      })
      .from(crmTickets)
      .where(
        and(
          base,
          or(
            eq(crmTickets.status, 'resolved'),
            eq(crmTickets.status, 'closed')
          )
        )
      );

    return {
      total: totals.total,
      openCount: openCount.count,
      avgResolutionHours: avgResolution.avgHours || null,
      byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      byCategory: Object.fromEntries(byCategory.map((r: any) => [r.category, r.count])),
      byPriority: Object.fromEntries(byPriority.map((r: any) => [r.priority, r.count])),
    };
  },

  // =====================================================================
  // COMMENTS
  // =====================================================================

  /**
   * List comments for a ticket
   */
  async listComments(db: Database, ticketId: string, workspaceId: string) {
    const comments = await db
      .select()
      .from(crmTicketComments)
      .where(
        and(
          eq(crmTicketComments.ticketId, ticketId),
          eq(crmTicketComments.workspaceId, workspaceId)
        )
      )
      .orderBy(crmTicketComments.createdAt);

    return comments;
  },

  /**
   * Add a comment to a ticket
   */
  async addComment(db: Database, data: NewCrmTicketComment) {
    const results = await db.insert(crmTicketComments).values(data).returning();
    return results[0];
  },
};
