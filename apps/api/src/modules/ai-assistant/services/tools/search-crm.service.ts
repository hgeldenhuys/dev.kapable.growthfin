/**
 * Search CRM Service
 * Text search across CRM entities for the AI assistant
 */

import { db } from '@agios/db/client';
import { crmLeads, crmContacts, crmAccounts } from '@agios/db';
import { eq, and, or, ilike, isNull, sql } from 'drizzle-orm';

export class SearchCrmError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'SearchCrmError';
  }
}

type SearchableEntity = 'leads' | 'contacts' | 'accounts';

interface SearchCrmParams {
  query: string;
  entityTypes: SearchableEntity[];
  limit: number;
}

export class SearchCrmService {
  /**
   * Validate and normalize parameters
   */
  static validateParams(params: any): SearchCrmParams {
    if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
      throw new SearchCrmError('query is required and must be a non-empty string', 'EMPTY_QUERY');
    }

    if (params.query.trim().length < 2) {
      throw new SearchCrmError('query must be at least 2 characters', 'QUERY_TOO_SHORT');
    }

    const validTypes: SearchableEntity[] = ['leads', 'contacts', 'accounts'];
    const entityTypes = (params.entityTypes || validTypes).filter((t: string) => validTypes.includes(t as SearchableEntity));

    if (entityTypes.length === 0) {
      throw new SearchCrmError('entityTypes must include at least one of: leads, contacts, accounts', 'INVALID_ENTITY_TYPES');
    }

    const limit = Math.min(Math.max(params.limit || 10, 1), 25);

    return {
      query: params.query.trim(),
      entityTypes,
      limit,
    };
  }

  /**
   * Search across CRM entities
   */
  static async execute(params: SearchCrmParams, workspaceId: string): Promise<any> {
    const results: Record<string, any[]> = {};
    const pattern = `%${params.query}%`;

    for (const entityType of params.entityTypes) {
      switch (entityType) {
        case 'leads':
          results['leads'] = await this.searchLeads(pattern, workspaceId, params.limit);
          break;
        case 'contacts':
          results['contacts'] = await this.searchContacts(pattern, workspaceId, params.limit);
          break;
        case 'accounts':
          results['accounts'] = await this.searchAccounts(pattern, workspaceId, params.limit);
          break;
      }
    }

    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    return {
      query: params.query,
      totalResults,
      results,
    };
  }

  // ---------------------------------------------------------------------------
  // Per-entity search
  // ---------------------------------------------------------------------------

  private static async searchLeads(pattern: string, workspaceId: string, limit: number) {
    const rows = await db
      .select({
        id: crmLeads.id,
        firstName: crmLeads.firstName,
        lastName: crmLeads.lastName,
        email: crmLeads.email,
        companyName: crmLeads.companyName,
        status: crmLeads.status,
        leadScore: crmLeads.leadScore,
      })
      .from(crmLeads)
      .where(
        and(
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt),
          or(
            ilike(crmLeads.firstName, pattern),
            ilike(crmLeads.lastName, pattern),
            ilike(crmLeads.email, pattern),
            ilike(crmLeads.companyName, pattern),
            sql`CONCAT(${crmLeads.firstName}, ' ', ${crmLeads.lastName}) ILIKE ${pattern}`
          )
        )
      )
      .limit(limit);

    return rows.map((r: any) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      email: r.email,
      company: r.companyName,
      status: r.status,
      score: r.leadScore,
    }));
  }

  private static async searchContacts(pattern: string, workspaceId: string, limit: number) {
    const rows = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        phone: crmContacts.phone,
        lifecycleStage: crmContacts.lifecycleStage,
      })
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt),
          or(
            ilike(crmContacts.firstName, pattern),
            ilike(crmContacts.lastName, pattern),
            ilike(crmContacts.email, pattern),
            sql`CONCAT(${crmContacts.firstName}, ' ', ${crmContacts.lastName}) ILIKE ${pattern}`
          )
        )
      )
      .limit(limit);

    return rows.map((r: any) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      email: r.email,
      phone: r.phone,
      lifecycleStage: r.lifecycleStage,
    }));
  }

  private static async searchAccounts(pattern: string, workspaceId: string, limit: number) {
    const rows = await db
      .select({
        id: crmAccounts.id,
        name: crmAccounts.name,
        industry: crmAccounts.industry,
        healthScore: crmAccounts.healthScore,
        website: crmAccounts.website,
      })
      .from(crmAccounts)
      .where(
        and(
          eq(crmAccounts.workspaceId, workspaceId),
          isNull(crmAccounts.deletedAt),
          or(
            ilike(crmAccounts.name, pattern),
            ilike(crmAccounts.website, pattern),
            ilike(crmAccounts.industry, pattern)
          )
        )
      )
      .limit(limit);

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      industry: r.industry,
      healthScore: r.healthScore,
      website: r.website,
    }));
  }
}
