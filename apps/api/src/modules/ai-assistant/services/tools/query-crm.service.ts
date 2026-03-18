/**
 * Query CRM Service
 * Structured CRM data queries for the AI assistant
 */

import { db } from '@agios/db/client';
import { crmLeads, crmContacts, crmAccounts, crmOpportunities, crmCampaigns } from '@agios/db';
import { eq, and, isNull, sql, count } from 'drizzle-orm';

export class QueryCrmError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'QueryCrmError';
  }
}

type CrmEntity = 'leads' | 'contacts' | 'accounts' | 'opportunities' | 'campaigns';
type CrmAction = 'list' | 'count' | 'get_by_id' | 'summary';

interface QueryCrmParams {
  entity: CrmEntity;
  action: CrmAction;
  id?: string;
  filters?: {
    status?: string;
    stage?: string;
    ownerId?: string;
    accountId?: string;
    contactId?: string;
  };
  limit?: number;
}

/** Fields to strip from records to save tokens */
const AUDIT_FIELDS = [
  'createdBy', 'updatedBy', 'deletedAt', 'canBeRevived', 'revivalCount',
  'consentMarketingDate', 'consentMarketingVersion', 'consentTransactionalDate',
  'dispositionChangedBy', 'blacklistedAt', 'blacklistNotes',
  'scoreBreakdown', 'propensityScoreUpdatedAt', 'healthScoreUpdatedAt',
] as const;

export class QueryCrmService {
  /**
   * Validate and normalize parameters
   */
  static validateParams(params: any): QueryCrmParams {
    if (!params.entity || !['leads', 'contacts', 'accounts', 'opportunities', 'campaigns'].includes(params.entity)) {
      throw new QueryCrmError(
        'entity must be one of: leads, contacts, accounts, opportunities, campaigns',
        'INVALID_ENTITY'
      );
    }

    if (!params.action || !['list', 'count', 'get_by_id', 'summary'].includes(params.action)) {
      throw new QueryCrmError(
        'action must be one of: list, count, get_by_id, summary',
        'INVALID_ACTION'
      );
    }

    if (params.action === 'get_by_id' && !params.id) {
      throw new QueryCrmError('id is required for get_by_id action', 'MISSING_ID');
    }

    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    return {
      entity: params.entity,
      action: params.action,
      id: params.id,
      filters: params.filters || {},
      limit,
    };
  }

  /**
   * Execute a CRM query
   */
  static async execute(params: QueryCrmParams, workspaceId: string): Promise<any> {
    switch (params.action) {
      case 'list':
        return this.handleList(params.entity, workspaceId, params.filters || {}, params.limit || 20);
      case 'count':
        return this.handleCount(params.entity, workspaceId, params.filters || {});
      case 'get_by_id':
        return this.handleGetById(params.entity, params.id!, workspaceId);
      case 'summary':
        return this.handleSummary(params.entity, workspaceId);
      default:
        throw new QueryCrmError(`Unknown action: ${params.action}`, 'INVALID_ACTION');
    }
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  private static async handleList(
    entity: CrmEntity,
    workspaceId: string,
    filters: NonNullable<QueryCrmParams['filters']>,
    limit: number
  ): Promise<any> {
    switch (entity) {
      case 'leads':
        return this.listLeads(workspaceId, filters, limit);
      case 'contacts':
        return this.listContacts(workspaceId, filters, limit);
      case 'accounts':
        return this.listAccounts(workspaceId, filters, limit);
      case 'opportunities':
        return this.listOpportunities(workspaceId, filters, limit);
      case 'campaigns':
        return this.listCampaigns(workspaceId, filters, limit);
    }
  }

  private static async listLeads(workspaceId: string, filters: any, limit: number) {
    const conditions = [eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt)];
    if (filters.status) conditions.push(eq(crmLeads.status, filters.status));
    if (filters.ownerId) conditions.push(eq(crmLeads.ownerId, filters.ownerId));

    const records = await db
      .select()
      .from(crmLeads)
      .where(and(...conditions))
      .orderBy(sql`${crmLeads.createdAt} DESC`)
      .limit(limit);

    return { records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)), total: records.length, limit };
  }

  private static async listContacts(workspaceId: string, filters: any, limit: number) {
    const conditions = [eq(crmContacts.workspaceId, workspaceId), isNull(crmContacts.deletedAt)];
    if (filters.status) conditions.push(eq(crmContacts.status, filters.status));
    if (filters.stage) conditions.push(eq(crmContacts.lifecycleStage, filters.stage));
    if (filters.ownerId) conditions.push(eq(crmContacts.ownerId, filters.ownerId));
    if (filters.accountId) conditions.push(eq(crmContacts.accountId, filters.accountId));

    const records = await db
      .select()
      .from(crmContacts)
      .where(and(...conditions))
      .orderBy(sql`${crmContacts.createdAt} DESC`)
      .limit(limit);

    return { records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)), total: records.length, limit };
  }

  private static async listAccounts(workspaceId: string, filters: any, limit: number) {
    const conditions = [eq(crmAccounts.workspaceId, workspaceId), isNull(crmAccounts.deletedAt)];
    if (filters.ownerId) conditions.push(eq(crmAccounts.ownerId, filters.ownerId));

    const records = await db
      .select()
      .from(crmAccounts)
      .where(and(...conditions))
      .orderBy(sql`${crmAccounts.createdAt} DESC`)
      .limit(limit);

    return { records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)), total: records.length, limit };
  }

  private static async listOpportunities(workspaceId: string, filters: any, limit: number) {
    const conditions = [eq(crmOpportunities.workspaceId, workspaceId), isNull(crmOpportunities.deletedAt)];
    if (filters.status) conditions.push(eq(crmOpportunities.status, filters.status));
    if (filters.stage) conditions.push(eq(crmOpportunities.stage, filters.stage));
    if (filters.ownerId) conditions.push(eq(crmOpportunities.ownerId, filters.ownerId));
    if (filters.accountId) conditions.push(eq(crmOpportunities.accountId, filters.accountId));
    if (filters.contactId) conditions.push(eq(crmOpportunities.contactId, filters.contactId));

    const records = await db
      .select()
      .from(crmOpportunities)
      .where(and(...conditions))
      .orderBy(sql`${crmOpportunities.createdAt} DESC`)
      .limit(limit);

    return { records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)), total: records.length, limit };
  }

  private static async listCampaigns(workspaceId: string, filters: any, limit: number) {
    const conditions = [eq(crmCampaigns.workspaceId, workspaceId), isNull(crmCampaigns.deletedAt)];
    if (filters.status) conditions.push(eq(crmCampaigns.status, filters.status));

    const records = await db
      .select()
      .from(crmCampaigns)
      .where(and(...conditions))
      .orderBy(sql`${crmCampaigns.createdAt} DESC`)
      .limit(limit);

    return { records: records.map((r: Record<string, any>) => this.sanitizeRecord(r)), total: records.length, limit };
  }

  // ---------------------------------------------------------------------------
  // COUNT
  // ---------------------------------------------------------------------------

  private static async handleCount(
    entity: CrmEntity,
    workspaceId: string,
    filters: NonNullable<QueryCrmParams['filters']>
  ): Promise<any> {
    switch (entity) {
      case 'leads':
        return this.countLeads(workspaceId, filters);
      case 'contacts':
        return this.countContacts(workspaceId, filters);
      case 'accounts':
        return this.countAccounts(workspaceId);
      case 'opportunities':
        return this.countOpportunities(workspaceId, filters);
      case 'campaigns':
        return this.countCampaigns(workspaceId, filters);
    }
  }

  private static async countLeads(workspaceId: string, filters: any) {
    const base = [eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt)];
    if (filters.status) base.push(eq(crmLeads.status, filters.status));
    if (filters.ownerId) base.push(eq(crmLeads.ownerId, filters.ownerId));

    const [result] = await db
      .select({ total: count() })
      .from(crmLeads)
      .where(and(...base));

    // Get breakdown by status
    const breakdown = await db
      .select({ status: crmLeads.status, count: count() })
      .from(crmLeads)
      .where(and(eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt)))
      .groupBy(crmLeads.status);

    return {
      total: result.total,
      breakdown: { byStatus: Object.fromEntries(breakdown.map((r: any) => [r.status, r.count])) },
    };
  }

  private static async countContacts(workspaceId: string, filters: any) {
    const base = [eq(crmContacts.workspaceId, workspaceId), isNull(crmContacts.deletedAt)];
    if (filters.status) base.push(eq(crmContacts.status, filters.status));
    if (filters.stage) base.push(eq(crmContacts.lifecycleStage, filters.stage));
    if (filters.ownerId) base.push(eq(crmContacts.ownerId, filters.ownerId));

    const [result] = await db
      .select({ total: count() })
      .from(crmContacts)
      .where(and(...base));

    const byStage = await db
      .select({ stage: crmContacts.lifecycleStage, count: count() })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, workspaceId), isNull(crmContacts.deletedAt)))
      .groupBy(crmContacts.lifecycleStage);

    const byStatus = await db
      .select({ status: crmContacts.status, count: count() })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, workspaceId), isNull(crmContacts.deletedAt)))
      .groupBy(crmContacts.status);

    return {
      total: result.total,
      breakdown: {
        byLifecycleStage: Object.fromEntries(byStage.map((r: any) => [r.stage, r.count])),
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      },
    };
  }

  private static async countAccounts(workspaceId: string) {
    const [result] = await db
      .select({ total: count() })
      .from(crmAccounts)
      .where(and(eq(crmAccounts.workspaceId, workspaceId), isNull(crmAccounts.deletedAt)));

    return { total: result.total };
  }

  private static async countOpportunities(workspaceId: string, filters: any) {
    const base = [eq(crmOpportunities.workspaceId, workspaceId), isNull(crmOpportunities.deletedAt)];
    if (filters.status) base.push(eq(crmOpportunities.status, filters.status));
    if (filters.stage) base.push(eq(crmOpportunities.stage, filters.stage));

    const [result] = await db
      .select({ total: count() })
      .from(crmOpportunities)
      .where(and(...base));

    const byStage = await db
      .select({ stage: crmOpportunities.stage, count: count() })
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.workspaceId, workspaceId), isNull(crmOpportunities.deletedAt)))
      .groupBy(crmOpportunities.stage);

    const byStatus = await db
      .select({ status: crmOpportunities.status, count: count() })
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.workspaceId, workspaceId), isNull(crmOpportunities.deletedAt)))
      .groupBy(crmOpportunities.status);

    return {
      total: result.total,
      breakdown: {
        byStage: Object.fromEntries(byStage.map((r: any) => [r.stage, r.count])),
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      },
    };
  }

  private static async countCampaigns(workspaceId: string, filters: any) {
    const base = [eq(crmCampaigns.workspaceId, workspaceId), isNull(crmCampaigns.deletedAt)];
    if (filters.status) base.push(eq(crmCampaigns.status, filters.status));

    const [result] = await db
      .select({ total: count() })
      .from(crmCampaigns)
      .where(and(...base));

    const byStatus = await db
      .select({ status: crmCampaigns.status, count: count() })
      .from(crmCampaigns)
      .where(and(eq(crmCampaigns.workspaceId, workspaceId), isNull(crmCampaigns.deletedAt)))
      .groupBy(crmCampaigns.status);

    return {
      total: result.total,
      breakdown: { byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])) },
    };
  }

  // ---------------------------------------------------------------------------
  // GET BY ID
  // ---------------------------------------------------------------------------

  private static async handleGetById(entity: CrmEntity, id: string, workspaceId: string): Promise<any> {
    let record: any;

    switch (entity) {
      case 'leads': {
        const [row] = await db.select().from(crmLeads)
          .where(and(eq(crmLeads.id, id), eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt)));
        record = row;
        break;
      }
      case 'contacts': {
        const [row] = await db.select().from(crmContacts)
          .where(and(eq(crmContacts.id, id), eq(crmContacts.workspaceId, workspaceId), isNull(crmContacts.deletedAt)));
        record = row;
        break;
      }
      case 'accounts': {
        const [row] = await db.select().from(crmAccounts)
          .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, workspaceId), isNull(crmAccounts.deletedAt)));
        record = row;
        break;
      }
      case 'opportunities': {
        const [row] = await db.select().from(crmOpportunities)
          .where(and(eq(crmOpportunities.id, id), eq(crmOpportunities.workspaceId, workspaceId), isNull(crmOpportunities.deletedAt)));
        record = row;
        break;
      }
      case 'campaigns': {
        const [row] = await db.select().from(crmCampaigns)
          .where(and(eq(crmCampaigns.id, id), eq(crmCampaigns.workspaceId, workspaceId), isNull(crmCampaigns.deletedAt)));
        record = row;
        break;
      }
    }

    if (!record) {
      throw new QueryCrmError(`${entity.slice(0, -1)} not found with id: ${id}`, 'NOT_FOUND');
    }

    return { record: this.sanitizeRecord(record) };
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------

  private static async handleSummary(entity: CrmEntity, workspaceId: string): Promise<any> {
    switch (entity) {
      case 'leads':
        return this.summaryLeads(workspaceId);
      case 'contacts':
        return this.summaryContacts(workspaceId);
      case 'accounts':
        return this.summaryAccounts(workspaceId);
      case 'opportunities':
        return this.summaryOpportunities(workspaceId);
      case 'campaigns':
        return this.summaryCampaigns(workspaceId);
    }
  }

  private static async summaryLeads(workspaceId: string) {
    const base = and(eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt));

    const [totals] = await db
      .select({
        total: count(),
        avgLeadScore: sql<number>`ROUND(AVG(${crmLeads.leadScore}))`,
      })
      .from(crmLeads)
      .where(base);

    const byStatus = await db
      .select({ status: crmLeads.status, count: count() })
      .from(crmLeads)
      .where(base)
      .groupBy(crmLeads.status);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recent] = await db
      .select({ count: count() })
      .from(crmLeads)
      .where(and(base, sql`${crmLeads.createdAt} >= ${sevenDaysAgo.toISOString()}`));

    return {
      summary: {
        total: totals.total,
        avgLeadScore: totals.avgLeadScore || 0,
        recentCount7d: recent.count,
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      },
    };
  }

  private static async summaryContacts(workspaceId: string) {
    const base = and(eq(crmContacts.workspaceId, workspaceId), isNull(crmContacts.deletedAt));

    const [totals] = await db
      .select({ total: count() })
      .from(crmContacts)
      .where(base);

    const byStage = await db
      .select({ stage: crmContacts.lifecycleStage, count: count() })
      .from(crmContacts)
      .where(base)
      .groupBy(crmContacts.lifecycleStage);

    const byStatus = await db
      .select({ status: crmContacts.status, count: count() })
      .from(crmContacts)
      .where(base)
      .groupBy(crmContacts.status);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recent] = await db
      .select({ count: count() })
      .from(crmContacts)
      .where(and(base, sql`${crmContacts.createdAt} >= ${sevenDaysAgo.toISOString()}`));

    return {
      summary: {
        total: totals.total,
        recentCount7d: recent.count,
        byLifecycleStage: Object.fromEntries(byStage.map((r: any) => [r.stage, r.count])),
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      },
    };
  }

  private static async summaryAccounts(workspaceId: string) {
    const base = and(eq(crmAccounts.workspaceId, workspaceId), isNull(crmAccounts.deletedAt));

    const [totals] = await db
      .select({
        total: count(),
        avgHealthScore: sql<number>`ROUND(AVG(${crmAccounts.healthScore}))`,
      })
      .from(crmAccounts)
      .where(base);

    // Top industries
    const topIndustries = await db
      .select({ industry: crmAccounts.industry, count: count() })
      .from(crmAccounts)
      .where(and(base, sql`${crmAccounts.industry} IS NOT NULL`))
      .groupBy(crmAccounts.industry)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    return {
      summary: {
        total: totals.total,
        avgHealthScore: totals.avgHealthScore || 0,
        topIndustries: Object.fromEntries(topIndustries.map((r: any) => [r.industry || 'Unknown', r.count])),
      },
    };
  }

  private static async summaryOpportunities(workspaceId: string) {
    const base = and(eq(crmOpportunities.workspaceId, workspaceId), isNull(crmOpportunities.deletedAt));

    const [totals] = await db
      .select({
        total: count(),
        pipelineValue: sql<string>`COALESCE(SUM(${crmOpportunities.amount}), 0)`,
        avgDealSize: sql<string>`COALESCE(ROUND(AVG(${crmOpportunities.amount}), 2), 0)`,
      })
      .from(crmOpportunities)
      .where(base);

    const byStage = await db
      .select({ stage: crmOpportunities.stage, count: count() })
      .from(crmOpportunities)
      .where(base)
      .groupBy(crmOpportunities.stage);

    const byStatus = await db
      .select({ status: crmOpportunities.status, count: count() })
      .from(crmOpportunities)
      .where(base)
      .groupBy(crmOpportunities.status);

    return {
      summary: {
        total: totals.total,
        pipelineValue: totals.pipelineValue,
        avgDealSize: totals.avgDealSize,
        byStage: Object.fromEntries(byStage.map((r: any) => [r.stage, r.count])),
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      },
    };
  }

  private static async summaryCampaigns(workspaceId: string) {
    const base = and(eq(crmCampaigns.workspaceId, workspaceId), isNull(crmCampaigns.deletedAt));

    const [totals] = await db
      .select({ total: count() })
      .from(crmCampaigns)
      .where(base);

    const byStatus = await db
      .select({ status: crmCampaigns.status, count: count() })
      .from(crmCampaigns)
      .where(base)
      .groupBy(crmCampaigns.status);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recent] = await db
      .select({ count: count() })
      .from(crmCampaigns)
      .where(and(base, sql`${crmCampaigns.createdAt} >= ${sevenDaysAgo.toISOString()}`));

    return {
      summary: {
        total: totals.total,
        recentCount7d: recent.count,
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r.count])),
      },
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

    // Truncate customFields to just keys
    if (sanitized.customFields && typeof sanitized.customFields === 'object') {
      const keys = Object.keys(sanitized.customFields);
      sanitized.customFields = keys.length > 0 ? `{${keys.join(', ')}} (${keys.length} fields)` : null;
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
