/**
 * Opportunities Service
 * Business logic for opportunity/deal operations
 */

import type { Database } from '@agios/db';
import { crmOpportunities } from '@agios/db';
import { eq, and, desc, gte } from 'drizzle-orm';
import type { OpportunityListFilters } from '../types';
import type { NewCrmOpportunity } from '@agios/db';

export const opportunityService = {
  async list(db: Database, filters: OpportunityListFilters) {
    const conditions = [eq(crmOpportunities.workspaceId, filters.workspaceId)];

    if (filters.stage) {
      conditions.push(eq(crmOpportunities.stage, filters.stage));
    }

    if (filters.status) {
      conditions.push(eq(crmOpportunities.status, filters.status));
    }

    if (filters.ownerId) {
      conditions.push(eq(crmOpportunities.ownerId, filters.ownerId));
    }

    if (filters.accountId) {
      conditions.push(eq(crmOpportunities.accountId, filters.accountId));
    }

    if (filters.contactId) {
      conditions.push(eq(crmOpportunities.contactId, filters.contactId));
    }

    return db
      .select()
      .from(crmOpportunities)
      .where(and(...conditions))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .orderBy(desc(crmOpportunities.expectedCloseDate));
  },

  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.id, id), eq(crmOpportunities.workspaceId, workspaceId)));
    return results[0] || null;
  },

  async create(db: Database, data: NewCrmOpportunity) {
    // Auto-set probability based on stage
    const probabilityByStage: Record<string, number> = {
      prospecting: 10,
      qualification: 25,
      proposal: 50,
      negotiation: 75,
      closed_won: 100,
      closed_lost: 0,
      abandoned: 0,
    };

    const dataWithProbability = {
      ...data,
      probability: probabilityByStage[data.stage || 'prospecting'] || 0,
    };

    const results = await db.insert(crmOpportunities).values(dataWithProbability).returning();
    return results[0];
  },

  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmOpportunity>) {
    // Auto-update probability when stage changes
    const probabilityByStage: Record<string, number> = {
      prospecting: 10,
      qualification: 25,
      proposal: 50,
      negotiation: 75,
      closed_won: 100,
      closed_lost: 0,
      abandoned: 0,
    };

    const updateData = { ...data, updatedAt: new Date() };

    if (data.stage) {
      updateData.probability = probabilityByStage[data.stage] || 0;

      // Auto-set status based on stage
      if (data.stage === 'closed_won') {
        updateData.status = 'won';
        updateData.actualCloseDate = new Date();
      } else if (data.stage === 'closed_lost') {
        updateData.status = 'lost';
        updateData.actualCloseDate = new Date();
      }
    }

    const results = await db
      .update(crmOpportunities)
      .set(updateData)
      .where(and(eq(crmOpportunities.id, id), eq(crmOpportunities.workspaceId, workspaceId)))
      .returning();
    return results[0] || null;
  },

  async delete(db: Database, id: string, workspaceId: string) {
    await db.delete(crmOpportunities).where(and(eq(crmOpportunities.id, id), eq(crmOpportunities.workspaceId, workspaceId)));
  },

  async getByContact(db: Database, contactId: string, workspaceId: string) {
    return db
      .select()
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.contactId, contactId), eq(crmOpportunities.workspaceId, workspaceId)))
      .orderBy(desc(crmOpportunities.createdAt));
  },

  async getByAccount(db: Database, accountId: string, workspaceId: string) {
    return db
      .select()
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.accountId, accountId), eq(crmOpportunities.workspaceId, workspaceId)))
      .orderBy(desc(crmOpportunities.createdAt));
  },

  async getRecent(db: Database, workspaceId: string, seconds: number) {
    const since = new Date(Date.now() - seconds * 1000);
    const results = await db
      .select()
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.workspaceId, workspaceId), gte(crmOpportunities.createdAt, since)))
      .orderBy(desc(crmOpportunities.createdAt));
    return results;
  },
};
