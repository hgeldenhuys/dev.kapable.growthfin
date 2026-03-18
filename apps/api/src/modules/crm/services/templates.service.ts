/**
 * Templates Service
 * Business logic for enrichment template management
 */

import type { Database } from '@agios/db';
import {
  crmTemplates,
  crmContactListMemberships,
  crmContacts,
  type NewCrmTemplate,
  type CrmTemplate,
  type TemplateType,
} from '@agios/db';
import { eq, and, isNull, or, ilike, desc, sql } from 'drizzle-orm';

export interface TemplateListFilters {
  workspaceId: string;
  type?: TemplateType;
  search?: string;
  model?: string;
  sortBy?: 'usage' | 'cost' | 'date';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface DryRunParams {
  workspaceId: string;
  listId: string;
  sampleSize: number;
}

export interface DryRunResult {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  enrichedData: Record<string, any>;
  cost: number;
  tokensUsed: number;
  reasoning: string;
  status: 'success' | 'failure';
  error?: string;
}

export const templatesService = {
  /**
   * Create a new template
   */
  async create(db: Database, data: NewCrmTemplate): Promise<CrmTemplate> {
    const results = await db.insert(crmTemplates).values(data).returning();
    return results[0];
  },

  /**
   * List templates with filtering and sorting
   */
  async list(db: Database, filters: TemplateListFilters) {
    const conditions = [
      eq(crmTemplates.workspaceId, filters.workspaceId),
      isNull(crmTemplates.deletedAt), // Exclude soft deleted
    ];

    // Filter by type
    if (filters.type) {
      conditions.push(eq(crmTemplates.type, filters.type));
    }

    // Filter by model
    if (filters.model) {
      conditions.push(eq(crmTemplates.model, filters.model));
    }

    // Search by name (case-insensitive)
    if (filters.search) {
      conditions.push(ilike(crmTemplates.name, `%${filters.search}%`));
    }

    // Determine sort column
    let orderColumn: any = crmTemplates.createdAt;
    if (filters.sortBy === 'usage') {
      // Sort by metadata->usageCount
      orderColumn = sql`(metadata->>'usageCount')::int`;
    } else if (filters.sortBy === 'cost') {
      // Sort by metadata->estimatedCostPerContact
      orderColumn = sql`(metadata->>'estimatedCostPerContact')::numeric`;
    } else if (filters.sortBy === 'date') {
      orderColumn = crmTemplates.updatedAt;
    }

    // Determine sort direction
    const sortDirection = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    // Apply pagination
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmTemplates)
      .where(and(...conditions));

    const total = countResult?.count || 0;

    // Get paginated results
    let query = db
      .select()
      .from(crmTemplates)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Apply ordering
    if (sortDirection === 'asc') {
      query = query.orderBy(orderColumn);
    } else {
      query = query.orderBy(desc(orderColumn));
    }

    const templates = await query;

    return {
      templates,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get template by ID
   */
  async getById(db: Database, id: string, workspaceId: string): Promise<CrmTemplate | null> {
    const results = await db
      .select()
      .from(crmTemplates)
      .where(
        and(
          eq(crmTemplates.id, id),
          eq(crmTemplates.workspaceId, workspaceId),
          isNull(crmTemplates.deletedAt)
        )
      );
    return results[0] || null;
  },

  /**
   * Update template
   */
  async update(
    db: Database,
    id: string,
    workspaceId: string,
    data: Partial<NewCrmTemplate>
  ): Promise<CrmTemplate | null> {
    const results = await db
      .update(crmTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmTemplates.id, id),
          eq(crmTemplates.workspaceId, workspaceId),
          isNull(crmTemplates.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Soft delete template
   */
  async delete(db: Database, id: string, workspaceId: string): Promise<CrmTemplate | null> {
    const results = await db
      .update(crmTemplates)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmTemplates.id, id),
          eq(crmTemplates.workspaceId, workspaceId),
          isNull(crmTemplates.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Increment usage count
   */
  async incrementUsageCount(db: Database, templateId: string): Promise<void> {
    await db.execute(sql`
      UPDATE crm_templates
      SET metadata = jsonb_set(
        metadata,
        '{usageCount}',
        to_jsonb(COALESCE((metadata->>'usageCount')::int, 0) + 1)
      )
      WHERE id = ${templateId}
    `);
  },

  /**
   * Update estimated cost per contact
   */
  async updateEstimatedCost(
    db: Database,
    templateId: string,
    cost: number
  ): Promise<void> {
    await db.execute(sql`
      UPDATE crm_templates
      SET
        metadata = jsonb_set(
          jsonb_set(
            jsonb_set(
              metadata,
              '{usageCount}',
              to_jsonb(COALESCE((metadata->>'usageCount')::int, 0) + 1)
            ),
            '{lastUsedAt}',
            to_jsonb(NOW()::text)
          ),
          '{estimatedCostPerContact}',
          to_jsonb(${cost})
        ),
        updated_at = NOW()
      WHERE id = ${templateId}
    `);
  },

  /**
   * Run dry-run test on template
   * Execute template on N sample contacts from a list
   */
  async runDryRun(
    db: Database,
    templateId: string,
    params: DryRunParams
  ): Promise<{
    results: DryRunResult[];
    totalCost: number;
    averageCostPerContact: number;
  }> {
    // Get the template
    const template = await this.getById(db, templateId, params.workspaceId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Get random contacts from the list
    const sampleSize = Math.min(params.sampleSize, 10); // Max 10 samples

    const contacts = await db
      .select({
        contact: crmContacts,
      })
      .from(crmContactListMemberships)
      .innerJoin(crmContacts, eq(crmContactListMemberships.contactId, crmContacts.id))
      .where(
        and(
          eq(crmContactListMemberships.listId, params.listId),
          isNull(crmContacts.deletedAt)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(sampleSize);

    if (contacts.length === 0) {
      throw new Error('No contacts found in the selected list');
    }

    // Execute enrichment on each contact
    // TODO: Implement actual enrichment logic
    // For now, return mock results
    const results: DryRunResult[] = contacts.map((c) => ({
      contactId: c.contact.id,
      contactName: `${c.contact.firstName || ''} ${c.contact.lastName || ''}`.trim() || 'Unknown',
      contactEmail: c.contact.email,
      enrichedData: {
        score: 85,
        category: 'High Value',
      },
      cost: 0.02,
      tokensUsed: 500,
      reasoning: 'Mock enrichment reasoning',
      status: 'success' as const,
    }));

    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const averageCostPerContact = totalCost / results.length;

    // Update template metadata with test results
    await db.execute(sql`
      UPDATE crm_templates
      SET metadata = jsonb_set(
        metadata,
        '{lastTestResults}',
        ${JSON.stringify({
          testedAt: new Date().toISOString(),
          sampleSize: results.length,
          successCount: results.filter((r) => r.status === 'success').length,
          totalCost,
          averageCostPerContact,
        })}::jsonb
      )
      WHERE id = ${templateId}
    `);

    return {
      results,
      totalCost,
      averageCostPerContact,
    };
  },
};
