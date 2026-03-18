/**
 * Campaigns Service
 * Business logic for campaign operations
 */

import type { Database } from '@agios/db';
import {
  crmCampaigns,
  crmCampaignMessages,
  crmCampaignRecipients,
  crmContacts,
  type NewCrmCampaign,
  type NewCrmCampaignMessage,
  type NewCrmCampaignRecipient,
} from '@agios/db';
import { eq, and, desc, isNull, gte, lte, inArray, notInArray, sql, ne } from 'drizzle-orm';

export interface CampaignListFilters {
  workspaceId: string;
  status?: string;
  createdAfter?: Date;
  limit?: number;
  offset?: number;
}

export interface AudienceCalculationResult {
  count: number;
  preview: any[];
}

export const campaignService = {
  /**
   * Create a new campaign (draft status by default)
   */
  async create(db: Database, data: NewCrmCampaign) {
    const results = await db.insert(crmCampaigns).values(data).returning();
    return results[0];
  },

  /**
   * List campaigns with filters
   */
  async list(db: Database, filters: CampaignListFilters) {
    const conditions = [
      eq(crmCampaigns.workspaceId, filters.workspaceId),
      isNull(crmCampaigns.deletedAt),
    ];

    if (filters.status) {
      conditions.push(eq(crmCampaigns.status, filters.status));
    }

    if (filters.createdAfter) {
      conditions.push(gte(crmCampaigns.createdAt, filters.createdAfter));
    }

    return db
      .select()
      .from(crmCampaigns)
      .where(and(...conditions))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .orderBy(desc(crmCampaigns.createdAt));
  },

  /**
   * Get campaign by ID
   */
  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmCampaigns)
      .where(
        and(
          eq(crmCampaigns.id, id),
          eq(crmCampaigns.workspaceId, workspaceId),
          isNull(crmCampaigns.deletedAt)
        )
      );
    return results[0] || null;
  },

  /**
   * Update campaign (only allowed if status is draft, unless updating status itself)
   */
  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmCampaign>) {
    // First check if campaign exists
    const campaign = await this.getById(db, id, workspaceId);
    if (!campaign) {
      return null;
    }

    // If updating fields other than status/startedAt/completedAt, require draft status
    const isStatusUpdate = data.status !== undefined || data.startedAt !== undefined || data.completedAt !== undefined;
    if (!isStatusUpdate && campaign.status !== 'draft') {
      throw new Error('Can only update campaign content in draft status');
    }

    const results = await db
      .update(crmCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmCampaigns.id, id),
          eq(crmCampaigns.workspaceId, workspaceId),
          isNull(crmCampaigns.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Soft delete campaign
   */
  async delete(db: Database, id: string, workspaceId: string) {
    const results = await db
      .update(crmCampaigns)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmCampaigns.id, id),
          eq(crmCampaigns.workspaceId, workspaceId),
          isNull(crmCampaigns.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Calculate audience size based on audience definition
   */
  async calculateAudience(
    db: Database,
    workspaceId: string,
    audienceDefinition: any
  ): Promise<AudienceCalculationResult> {
    const conditions = [
      eq(crmContacts.workspaceId, workspaceId),
      isNull(crmContacts.deletedAt),
      sql`${crmContacts.email} IS NOT NULL`, // Must have email for email campaigns
    ];

    // Apply audience filters
    if (audienceDefinition.conditions) {
      for (const condition of audienceDefinition.conditions) {
        const { field, operator, value } = condition;

        // Handle lifecycle_stage field
        if (field === 'lifecycle_stage') {
          if (operator === 'in' && Array.isArray(value)) {
            conditions.push(inArray(crmContacts.lifecycleStage, value));
          } else if (operator === 'not_in' && Array.isArray(value)) {
            conditions.push(notInArray(crmContacts.lifecycleStage, value));
          }
        }

        // Handle lead_score field (number operators)
        if (field === 'lead_score') {
          const numValue = typeof value === 'number' ? value : Number(value);
          if (operator === '>=' || operator === 'gte') {
            conditions.push(gte(crmContacts.leadScore, numValue));
          } else if (operator === '<=' || operator === 'lte') {
            conditions.push(lte(crmContacts.leadScore, numValue));
          } else if (operator === '=' || operator === 'eq' || operator === 'equals') {
            conditions.push(eq(crmContacts.leadScore, numValue));
          }
        }

        // Handle status field
        if (field === 'status') {
          if (operator === 'equals' || operator === 'eq' || operator === '=') {
            conditions.push(eq(crmContacts.status, value));
          } else if (operator === 'not_equals' || operator === 'ne') {
            conditions.push(ne(crmContacts.status, value));
          }
        }

        // Handle tags field (array contains)
        if (field === 'tags' && Array.isArray(value)) {
          // Check if contact tags array overlaps with any of the filter values
          if (operator === 'in' || operator === 'contains_any') {
            conditions.push(sql`${crmContacts.tags} && ${JSON.stringify(value)}::jsonb`);
          } else if (operator === 'not_in') {
            conditions.push(sql`NOT (${crmContacts.tags} && ${JSON.stringify(value)}::jsonb)`);
          }
        }
      }
    }

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmContacts)
      .where(and(...conditions));

    const count = Number(countResult[0]?.count || 0);

    // Get preview (first 10)
    const preview = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        lifecycleStage: crmContacts.lifecycleStage,
      })
      .from(crmContacts)
      .where(and(...conditions))
      .limit(10);

    return { count, preview };
  },

  /**
   * Add recipients to campaign (with de-duplication)
   */
  async addRecipients(
    db: Database,
    campaignId: string,
    contactIds: string[],
    workspaceId: string,
    addedBy: string
  ) {
    // Check for existing recipients to prevent duplicates
    const existingRecipients = await db
      .select({
        contactId: crmCampaignRecipients.contactId,
      })
      .from(crmCampaignRecipients)
      .where(
        and(
          eq(crmCampaignRecipients.campaignId, campaignId),
          eq(crmCampaignRecipients.workspaceId, workspaceId),
          inArray(crmCampaignRecipients.contactId, contactIds),
          isNull(crmCampaignRecipients.deletedAt)
        )
      );

    const existingContactIds = new Set(existingRecipients.map((r) => r.contactId));

    // Filter out duplicates
    const newContactIds = contactIds.filter((id) => !existingContactIds.has(id));

    // If no new contacts to add, return empty array
    if (newContactIds.length === 0) {
      return [];
    }

    const recipientData: NewCrmCampaignRecipient[] = newContactIds.map((contactId) => ({
      campaignId,
      contactId,
      workspaceId,
      addedBy,
      status: 'pending',
    }));

    const results = await db.insert(crmCampaignRecipients).values(recipientData).returning();

    // Update campaign total_recipients with ONLY new recipients count
    await db
      .update(crmCampaigns)
      .set({
        totalRecipients: sql`${crmCampaigns.totalRecipients} + ${newContactIds.length}`,
        updatedAt: new Date(),
      })
      .where(eq(crmCampaigns.id, campaignId));

    return results;
  },

  /**
   * Get recipients for a campaign
   */
  async getRecipients(db: Database, campaignId: string, workspaceId: string) {
    return db
      .select({
        id: crmCampaignRecipients.id,
        contactId: crmCampaignRecipients.contactId,
        status: crmCampaignRecipients.status,
        statusReason: crmCampaignRecipients.statusReason,
        sentAt: crmCampaignRecipients.sentAt,
        deliveredAt: crmCampaignRecipients.deliveredAt,
        firstOpenedAt: crmCampaignRecipients.firstOpenedAt,
        openCount: crmCampaignRecipients.openCount,
        firstClickedAt: crmCampaignRecipients.firstClickedAt,
        clickCount: crmCampaignRecipients.clickCount,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
      })
      .from(crmCampaignRecipients)
      .innerJoin(crmContacts, eq(crmCampaignRecipients.contactId, crmContacts.id))
      .where(
        and(
          eq(crmCampaignRecipients.campaignId, campaignId),
          eq(crmCampaignRecipients.workspaceId, workspaceId),
          isNull(crmCampaignRecipients.deletedAt)
        )
      )
      .orderBy(desc(crmCampaignRecipients.addedToCampaignAt));
  },
};

export const campaignMessageService = {
  /**
   * Create a campaign message
   */
  async create(db: Database, data: NewCrmCampaignMessage) {
    const results = await db.insert(crmCampaignMessages).values(data).returning();
    return results[0];
  },

  /**
   * List messages for a campaign
   */
  async list(db: Database, campaignId: string, workspaceId: string) {
    return db
      .select()
      .from(crmCampaignMessages)
      .where(
        and(
          eq(crmCampaignMessages.campaignId, campaignId),
          eq(crmCampaignMessages.workspaceId, workspaceId),
          isNull(crmCampaignMessages.deletedAt)
        )
      )
      .orderBy(desc(crmCampaignMessages.createdAt));
  },

  /**
   * Get message by ID
   */
  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmCampaignMessages)
      .where(
        and(
          eq(crmCampaignMessages.id, id),
          eq(crmCampaignMessages.workspaceId, workspaceId),
          isNull(crmCampaignMessages.deletedAt)
        )
      );
    return results[0] || null;
  },

  /**
   * Update message
   */
  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmCampaignMessage>) {
    const results = await db
      .update(crmCampaignMessages)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmCampaignMessages.id, id),
          eq(crmCampaignMessages.workspaceId, workspaceId),
          isNull(crmCampaignMessages.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Soft delete message
   */
  async delete(db: Database, id: string, workspaceId: string) {
    const results = await db
      .update(crmCampaignMessages)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmCampaignMessages.id, id),
          eq(crmCampaignMessages.workspaceId, workspaceId),
          isNull(crmCampaignMessages.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Preview message with merge tags replaced
   */
  async previewMessage(db: Database, messageId: string, contactId: string, workspaceId: string) {
    // Get message
    const message = await this.getById(db, messageId, workspaceId);
    if (!message) {
      return null;
    }

    // Get contact
    const contacts = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt)
        )
      );

    const contact = contacts[0];
    if (!contact) {
      return null;
    }

    // Replace merge tags
    const replaceMergeTags = (template: string): string => {
      return template.replace(/\{\{(\w+)(?:\|default:"([^"]+)")?\}\}/g, (match, field, defaultValue) => {
        const value = contact[field] || message.fallbackValues[field] || defaultValue || match;
        return String(value);
      });
    };

    return {
      subject: message.subject ? replaceMergeTags(message.subject) : null,
      bodyText: replaceMergeTags(message.bodyText),
      bodyHtml: message.bodyHtml ? replaceMergeTags(message.bodyHtml) : null,
      previewText: message.previewText ? replaceMergeTags(message.previewText) : null,
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
      },
    };
  },
};
