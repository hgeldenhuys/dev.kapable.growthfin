/**
 * Query Tickets AI Tool Service
 * Allows AI assistant to search, list, count, and summarize tickets
 */

import { db } from '@agios/db/client';
import { crmTickets } from '@agios/db';
import { eq, and, isNull, or, ilike, sql, count } from 'drizzle-orm';

export class QueryTicketsError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'QueryTicketsError';
  }
}

type TicketAction = 'list' | 'count' | 'get_by_id' | 'summary' | 'search';

interface QueryTicketsParams {
  action: TicketAction;
  id?: string;
  filters?: {
    status?: string;
    category?: string;
    priority?: string;
    assigneeId?: string;
    entityId?: string;
  };
  query?: string;
  limit?: number;
}

/** Fields to strip from records to save tokens */
const AUDIT_FIELDS = [
  'createdBy', 'updatedBy', 'deletedAt', 'canBeRevived', 'revivalCount',
  'customFields', 'aiConversationId',
] as const;

export class QueryTicketsService {
  /**
   * Validate and normalize parameters
   */
  static validateParams(params: any): QueryTicketsParams {
    const validActions = ['list', 'count', 'get_by_id', 'summary', 'search'];

    if (!params.action || !validActions.includes(params.action)) {
      throw new QueryTicketsError(
        `action must be one of: ${validActions.join(', ')}`,
        'INVALID_ACTION'
      );
    }

    if (params.action === 'get_by_id' && !params.id) {
      throw new QueryTicketsError('id is required for get_by_id action', 'MISSING_ID');
    }

    if (params.action === 'search' && (!params.query || params.query.trim().length < 2)) {
      throw new QueryTicketsError(
        'query is required for search action and must be at least 2 characters',
        'INVALID_QUERY'
      );
    }

    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    return {
      action: params.action,
      id: params.id,
      filters: params.filters || {},
      query: params.query?.trim(),
      limit,
    };
  }

  /**
   * Execute a ticket query
   */
  static async execute(params: QueryTicketsParams, workspaceId: string): Promise<any> {
    switch (params.action) {
      case 'list':
        return this.handleList(workspaceId, params.filters || {}, params.limit || 20);
      case 'count':
        return this.handleCount(workspaceId, params.filters || {});
      case 'get_by_id':
        return this.handleGetById(params.id!, workspaceId);
      case 'summary':
        return this.handleSummary(workspaceId);
      case 'search':
        return this.handleSearch(workspaceId, params.query!, params.limit || 20);
      default:
        throw new QueryTicketsError(`Unknown action: ${params.action}`, 'INVALID_ACTION');
    }
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  private static async handleList(workspaceId: string, filters: any, limit: number) {
    const conditions = [eq(crmTickets.workspaceId, workspaceId), isNull(crmTickets.deletedAt)];
    if (filters.status) conditions.push(eq(crmTickets.status, filters.status));
    if (filters.category) conditions.push(eq(crmTickets.category, filters.category));
    if (filters.priority) conditions.push(eq(crmTickets.priority, filters.priority));
    if (filters.assigneeId) conditions.push(eq(crmTickets.assigneeId, filters.assigneeId));
    if (filters.entityId) conditions.push(eq(crmTickets.entityId, filters.entityId));

    const records = await db
      .select()
      .from(crmTickets)
      .where(and(...conditions))
      .orderBy(sql`${crmTickets.createdAt} DESC`)
      .limit(limit);

    return {
      records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)),
      total: records.length,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // COUNT
  // ---------------------------------------------------------------------------

  private static async handleCount(workspaceId: string, filters: any) {
    const conditions = [eq(crmTickets.workspaceId, workspaceId), isNull(crmTickets.deletedAt)];
    if (filters.status) conditions.push(eq(crmTickets.status, filters.status));
    if (filters.category) conditions.push(eq(crmTickets.category, filters.category));
    if (filters.priority) conditions.push(eq(crmTickets.priority, filters.priority));

    const [result] = await db
      .select({ total: count() })
      .from(crmTickets)
      .where(and(...conditions));

    const byStatus = await db
      .select({ status: crmTickets.status, count: count() })
      .from(crmTickets)
      .where(and(eq(crmTickets.workspaceId, workspaceId), isNull(crmTickets.deletedAt)))
      .groupBy(crmTickets.status);

    const byCategory = await db
      .select({ category: crmTickets.category, count: count() })
      .from(crmTickets)
      .where(and(eq(crmTickets.workspaceId, workspaceId), isNull(crmTickets.deletedAt)))
      .groupBy(crmTickets.category);

    return {
      total: result.total,
      breakdown: {
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
        byCategory: Object.fromEntries(byCategory.map((r: any) => [r.category, r.count])),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // GET BY ID
  // ---------------------------------------------------------------------------

  private static async handleGetById(id: string, workspaceId: string) {
    const [record] = await db
      .select()
      .from(crmTickets)
      .where(
        and(
          eq(crmTickets.id, id),
          eq(crmTickets.workspaceId, workspaceId),
          isNull(crmTickets.deletedAt)
        )
      );

    if (!record) {
      throw new QueryTicketsError(`Ticket not found with id: ${id}`, 'NOT_FOUND');
    }

    return { record: this.sanitizeRecord(record) };
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------

  private static async handleSummary(workspaceId: string) {
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

    // Open count
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

    // Average resolution time
    const [avgResolution] = await db
      .select({
        avgHours: sql<number>`ROUND(AVG(EXTRACT(EPOCH FROM (${crmTickets.updatedAt} - ${crmTickets.createdAt})) / 3600)::numeric, 1)`,
      })
      .from(crmTickets)
      .where(
        and(
          base,
          or(eq(crmTickets.status, 'resolved'), eq(crmTickets.status, 'closed'))
        )
      );

    // Recent 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recent] = await db
      .select({ count: count() })
      .from(crmTickets)
      .where(and(base, sql`${crmTickets.createdAt} >= ${sevenDaysAgo.toISOString()}`));

    return {
      summary: {
        total: totals.total,
        openCount: openCount.count,
        recentCount7d: recent.count,
        avgResolutionHours: avgResolution.avgHours || null,
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
        byCategory: Object.fromEntries(byCategory.map((r: any) => [r.category, r.count])),
        byPriority: Object.fromEntries(byPriority.map((r: any) => [r.priority, r.count])),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  private static async handleSearch(workspaceId: string, query: string, limit: number) {
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
      .orderBy(sql`${crmTickets.createdAt} DESC`)
      .limit(limit);

    return {
      records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)),
      total: records.length,
      query,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Strip audit fields and truncate large data to save tokens
   */
  private static sanitizeRecord(record: any): any {
    const sanitized = { ...record };

    for (const field of AUDIT_FIELDS) {
      delete sanitized[field];
    }

    // Truncate long string fields
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = value.slice(0, 200) + '...';
      }
    }

    return sanitized;
  }
}
