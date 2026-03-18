/**
 * Accounts Service
 * Business logic for CRM account operations
 */

import type { Database } from '@agios/db';
import { crmAccounts, crmContacts, crmOpportunities } from '@agios/db';
import { eq, and, desc, ilike, gte } from 'drizzle-orm';
import type { AccountListFilters, NewCRMAccount } from '../types';
import { validateAccountHierarchy } from '../utils';
import { calculateHealthScore } from './health-score';

export const accountService = {
  async list(db: Database, filters: AccountListFilters) {
    const conditions = [eq(crmAccounts.workspaceId, filters.workspaceId)];

    if (filters.status) {
      conditions.push(eq(crmAccounts.status, filters.status));
    }

    if (filters.ownerId) {
      conditions.push(eq(crmAccounts.ownerId, filters.ownerId));
    }

    if (filters.parentAccountId) {
      conditions.push(eq(crmAccounts.parentAccountId, filters.parentAccountId));
    }

    return db
      .select()
      .from(crmAccounts)
      .where(and(...conditions))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .orderBy(desc(crmAccounts.createdAt));
  },

  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmAccounts)
      .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, workspaceId)));
    return results[0] || null;
  },

  async create(db: Database, data: NewCRMAccount) {
    // US-ENH-006: Validate hierarchy if parent account is set
    if (data.parentAccountId) {
      // Generate temporary ID for validation (will be replaced by DB)
      const tempId = data.id || crypto.randomUUID();
      await validateAccountHierarchy(
        tempId,
        data.parentAccountId,
        data.workspaceId,
        db
      );
    }

    // US-CRM-ADDR-002: Pass data as-is - Drizzle will handle all fields including addresses
    console.log('[Account Service] Creating account with data:', JSON.stringify(data, null, 2));
    const results = await db.insert(crmAccounts).values(data).returning();
    console.log('[Account Service] Created account:', JSON.stringify(results[0], null, 2));
    return results[0];
  },

  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCRMAccount>) {
    // US-ENH-006: Validate hierarchy if parentAccountId is being changed
    if (data.parentAccountId !== undefined) {
      await validateAccountHierarchy(
        id,
        data.parentAccountId,
        workspaceId,
        db
      );
    }

    // US-CRM-ADDR-002: Handle address fields (all optional/nullable)
    const updateData: Partial<NewCRMAccount> = {
      ...data,
      updatedAt: new Date(),
    };

    // Process billing address fields if any are provided
    if (data.billingAddressLine1 !== undefined) updateData.billingAddressLine1 = data.billingAddressLine1 || null;
    if (data.billingAddressLine2 !== undefined) updateData.billingAddressLine2 = data.billingAddressLine2 || null;
    if (data.billingCity !== undefined) updateData.billingCity = data.billingCity || null;
    if (data.billingStateProvince !== undefined) updateData.billingStateProvince = data.billingStateProvince || null;
    if (data.billingPostalCode !== undefined) updateData.billingPostalCode = data.billingPostalCode || null;
    if (data.billingCountry !== undefined) updateData.billingCountry = data.billingCountry || null;

    // Process shipping address fields if any are provided
    if (data.shippingAddressLine1 !== undefined) updateData.shippingAddressLine1 = data.shippingAddressLine1 || null;
    if (data.shippingAddressLine2 !== undefined) updateData.shippingAddressLine2 = data.shippingAddressLine2 || null;
    if (data.shippingCity !== undefined) updateData.shippingCity = data.shippingCity || null;
    if (data.shippingStateProvince !== undefined) updateData.shippingStateProvince = data.shippingStateProvince || null;
    if (data.shippingPostalCode !== undefined) updateData.shippingPostalCode = data.shippingPostalCode || null;
    if (data.shippingCountry !== undefined) updateData.shippingCountry = data.shippingCountry || null;

    const results = await db
      .update(crmAccounts)
      .set(updateData)
      .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, workspaceId)))
      .returning();
    return results[0] || null;
  },

  async delete(db: Database, id: string, workspaceId: string, options?: { force?: boolean }) {
    // US-ENH-005: Check for relationships before allowing delete
    const [childAccounts, opportunities, contacts] = await Promise.all([
      // Check for child accounts
      db.query.crmAccounts.findMany({
        where: and(
          eq(crmAccounts.parentAccountId, id),
          eq(crmAccounts.workspaceId, workspaceId)
        ),
      }),
      // Check for related opportunities (any status)
      db.query.crmOpportunities.findMany({
        where: and(
          eq(crmOpportunities.accountId, id),
          eq(crmOpportunities.workspaceId, workspaceId)
        ),
      }),
      // Check for related contacts (any status)
      db.query.crmContacts.findMany({
        where: and(
          eq(crmContacts.accountId, id),
          eq(crmContacts.workspaceId, workspaceId)
        ),
      }),
    ]);

    const hasRelationships =
      childAccounts.length > 0 ||
      opportunities.length > 0 ||
      contacts.length > 0;

    // Block delete if relationships exist and not force delete
    if (hasRelationships && !options?.force) {
      const errorData = {
        error: 'Cannot delete account with active relationships',
        relationships: {
          childAccounts: childAccounts.length,
          opportunities: opportunities.length,
          contacts: contacts.length,
        },
        suggestion: 'Archive account instead or remove relationships first',
      };
      throw new Error(JSON.stringify(errorData));
    }

    // If force delete with relationships, log for audit trail
    if (hasRelationships && options?.force) {
      // TODO: Create audit log entry when audit system is implemented
      // For now, we proceed with the delete
      console.warn(`[FORCE DELETE] Account ${id} deleted with ${childAccounts.length} child accounts, ${opportunities.length} opportunities, ${contacts.length} contacts`);
    }

    // Proceed with delete
    await db.delete(crmAccounts).where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, workspaceId)));
  },

  async search(db: Database, workspaceId: string, query: string, limit = 50) {
    const searchPattern = `%${query}%`;
    const results = await db
      .select()
      .from(crmAccounts)
      .where(and(eq(crmAccounts.workspaceId, workspaceId), ilike(crmAccounts.name, searchPattern)))
      .limit(limit)
      .orderBy(desc(crmAccounts.createdAt));
    return results;
  },

  async getChildAccounts(db: Database, parentId: string, workspaceId: string) {
    return db
      .select()
      .from(crmAccounts)
      .where(and(eq(crmAccounts.parentAccountId, parentId), eq(crmAccounts.workspaceId, workspaceId)))
      .orderBy(desc(crmAccounts.createdAt));
  },

  async getRecent(db: Database, workspaceId: string, seconds: number) {
    const since = new Date(Date.now() - seconds * 1000);
    const results = await db
      .select()
      .from(crmAccounts)
      .where(and(eq(crmAccounts.workspaceId, workspaceId), gte(crmAccounts.createdAt, since)))
      .orderBy(desc(crmAccounts.createdAt));
    return results;
  },

  /**
   * US-ENH-004: Update health score for an account
   * Calculates and updates the health score based on activity, engagement, and revenue
   *
   * @param db - Database connection
   * @param id - Account ID
   * @param workspaceId - Workspace ID (for isolation)
   * @returns Updated account with new health score
   */
  async updateHealthScore(db: Database, id: string, workspaceId: string) {
    // Calculate health score
    const { healthScore } = await calculateHealthScore(id, workspaceId, db);

    // Update account with new health score and timestamp
    const results = await db
      .update(crmAccounts)
      .set({
        healthScore,
        healthScoreUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, workspaceId)))
      .returning();

    return results[0] || null;
  },
};
