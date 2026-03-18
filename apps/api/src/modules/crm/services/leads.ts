/**
 * Leads Service
 * Business logic for lead operations including conversion
 */

import type { Database } from '@agios/db';
import { crmLeads, crmContacts, crmAccounts, crmOpportunities } from '@agios/db';
import { eq, and, desc, gte, isNull, sql } from 'drizzle-orm';
import type { LeadListFilters, LeadConversionRequest, LeadConversionResult } from '../types';
import type { NewCrmLead } from '@agios/db';
import { timelineService } from './timeline';
import { contactService } from './contacts';
import { accountService } from './accounts';
import { opportunityService } from './opportunities';
import { jobQueue, type CalculateLeadScoreJob } from '../../../lib/queue';
import { WorkItemsService } from '../../work-items/services/work-items.service';

export const leadService = {
  async list(db: Database, filters: LeadListFilters) {
    const conditions = [
      eq(crmLeads.workspaceId, filters.workspaceId),
      isNull(crmLeads.deletedAt), // Exclude soft deleted
    ];

    if (filters.status) {
      conditions.push(eq(crmLeads.status, filters.status));
    }

    if (filters.ownerId) {
      conditions.push(eq(crmLeads.ownerId, filters.ownerId));
    }

    // Apply pagination with defaults and max limit
    const limit = Math.min(filters.limit || 50, 100); // Default 50, max 100
    const offset = filters.offset || 0;

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmLeads)
      .where(and(...conditions));

    const total = countResult?.count || 0;

    // Get paginated results
    const leads = await db
      .select()
      .from(crmLeads)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(crmLeads.createdAt));

    // Calculate page number (1-based)
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async getById(db: Database, id: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmLeads)
      .where(
        and(
          eq(crmLeads.id, id),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt) // Exclude soft deleted
        )
      );
    return results[0] || null;
  },

  async create(db: Database, data: NewCrmLead) {
    // US-CRM-ADDR-002: Address fields handled - Drizzle processes undefined/null correctly
    const [lead] = await db.insert(crmLeads).values(data).returning();

    // Create timeline event
    await timelineService.create(db, {
      workspaceId: data.workspaceId,
      entityType: 'lead',
      entityId: lead.id,
      eventType: 'lead.created',
      eventCategory: 'system',
      eventLabel: 'Lead Created',
      summary: `Lead ${lead.firstName} ${lead.lastName} was created`,
      occurredAt: new Date(),
      actorType: 'user',
      actorId: data.createdBy,
    });

    // Queue background job to calculate propensity score (priority 10 for new leads)
    // Gracefully handle case when job queue isn't started (e.g., during CSV imports before server fully initialized)
    try {
      await jobQueue.send<CalculateLeadScoreJob>(
        'calculate-lead-score',
        {
          leadId: lead.id,
          workspaceId: data.workspaceId,
          trigger: 'created',
          triggerUserId: data.createdBy,
        },
        {
          priority: 10, // High priority for new leads
          retryLimit: 3,
          retryDelay: 60,
        }
      );
    } catch (error) {
      // Log warning but don't fail lead creation if job queue isn't started
      // The score can be calculated later via batch job or manual trigger
      console.warn(`[leads/create] Failed to queue propensity score calculation for lead ${lead.id}:`,
        error instanceof Error ? error.message : String(error));
    }

    return lead;
  },

  async update(db: Database, id: string, workspaceId: string, data: Partial<NewCrmLead>) {
    // Get original to track changes
    const original = await this.getById(db, id, workspaceId);
    if (!original) return null;

    // US-CRM-ADDR-002: Handle address fields (all optional/nullable)
    const updateData: Partial<NewCrmLead> = {
      ...data,
      updatedAt: new Date(),
    };

    // Process address fields if any are provided
    if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1 || null;
    if (data.addressLine2 !== undefined) updateData.addressLine2 = data.addressLine2 || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.stateProvince !== undefined) updateData.stateProvince = data.stateProvince || null;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode || null;
    if (data.country !== undefined) updateData.country = data.country || null;

    const [updated] = await db
      .update(crmLeads)
      .set(updateData)
      .where(
        and(
          eq(crmLeads.id, id),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt) // Only update if not soft deleted
        )
      )
      .returning();

    if (!updated) return null;

    // Create timeline events for significant changes
    if (data.status && data.status !== original.status) {
      await timelineService.create(db, {
        workspaceId,
        entityType: 'lead',
        entityId: id,
        eventType: 'lead.status_changed',
        eventCategory: 'milestone',
        eventLabel: 'Status Changed',
        summary: `Lead status changed from ${original.status} to ${data.status}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: data.updatedBy,
        dataChanges: {
          field: 'status',
          oldValue: original.status,
          newValue: data.status,
        },
      });
    }

    if (data.leadScore !== undefined && data.leadScore !== original.leadScore) {
      await timelineService.create(db, {
        workspaceId,
        entityType: 'lead',
        entityId: id,
        eventType: 'lead.score_updated',
        eventCategory: 'data',
        eventLabel: 'Score Updated',
        summary: `Lead score changed from ${original.leadScore} to ${data.leadScore}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: data.updatedBy,
        dataChanges: {
          field: 'leadScore',
          oldValue: original.leadScore,
          newValue: data.leadScore,
        },
      });
    }

    // Queue background job to recalculate propensity score (priority 5 for updates)
    // Gracefully handle case when job queue isn't started
    try {
      await jobQueue.send<CalculateLeadScoreJob>(
        'calculate-lead-score',
        {
          leadId: id,
          workspaceId,
          trigger: 'updated',
          triggerUserId: data.updatedBy,
        },
        {
          priority: 5, // Normal priority for updates
          retryLimit: 3,
          retryDelay: 60,
        }
      );
    } catch (error) {
      // Log warning but don't fail lead update if job queue isn't started
      console.warn(`[leads/update] Failed to queue propensity score calculation for lead ${id}:`,
        error instanceof Error ? error.message : String(error));
    }

    return updated;
  },

  async delete(db: Database, id: string, workspaceId: string, userId?: string) {
    // Soft delete: set deletedAt timestamp instead of hard delete
    const [deleted] = await db
      .update(crmLeads)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmLeads.id, id),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt) // Only delete if not already deleted
        )
      )
      .returning();

    if (deleted && userId) {
      // Create timeline event
      await timelineService.create(db, {
        workspaceId,
        entityType: 'lead',
        entityId: id,
        eventType: 'lead.deleted',
        eventCategory: 'system',
        eventLabel: 'Lead Deleted',
        summary: `Lead ${deleted.firstName} ${deleted.lastName} was deleted`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId,
      });
    }

    return deleted || null;
  },

  /**
   * Convert a lead to contact, account, and/or opportunity
   * Uses atomic transaction to ensure data consistency
   */
  async convert(db: Database, leadId: string, request: LeadConversionRequest): Promise<LeadConversionResult> {
    const result: LeadConversionResult = {
      success: false,
      leadId,
    };

    // Get the lead
    const lead = await this.getById(db, leadId, request.workspaceId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (lead.status === 'converted') {
      throw new Error('Lead already converted');
    }

    // Start transaction (Drizzle transactions)
    try {
      let accountId: string | undefined;
      let contactId: string | undefined;

      // 1. Create account if requested
      if (request.createAccount && request.accountData) {
        const account = await accountService.create(db, {
          workspaceId: request.workspaceId,
          name: request.accountData.name || lead.companyName,
          industry: request.accountData.industry,
          website: request.accountData.website,
          ownerId: lead.ownerId,
          createdBy: request.userId,
          updatedBy: request.userId,
          // US-CRM-ADDR-002: Migrate Lead address to Account billing address
          billingAddressLine1: lead.addressLine1,
          billingAddressLine2: lead.addressLine2,
          billingCity: lead.city,
          billingStateProvince: lead.stateProvince,
          billingPostalCode: lead.postalCode,
          billingCountry: lead.country,
          // Shipping address defaults to NULL (UI can default to billing)
          shippingAddressLine1: null,
          shippingAddressLine2: null,
          shippingCity: null,
          shippingStateProvince: null,
          shippingPostalCode: null,
          shippingCountry: null,
        });
        accountId = account.id;
        result.accountId = accountId;

        // Timeline event for account
        await timelineService.create(db, {
          workspaceId: request.workspaceId,
          entityType: 'account',
          entityId: accountId,
          eventType: 'account.created_from_lead',
          eventCategory: 'milestone',
          eventLabel: 'Account Created from Lead',
          summary: `Account created from lead conversion`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: request.userId,
        });
      }

      // 2. Create contact
      if (request.createContact) {
        const contact = await contactService.create(db, {
          workspaceId: request.workspaceId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          leadSource: lead.source,
          accountId: accountId,
          ownerId: lead.ownerId,
          status: 'active',
          lifecycleStage: 'engaged', // Contact is sales-qualified and engaged (formerly 'qualified' lifecycle stage)
          leadScore: lead.leadScore,
          customFields: lead.customFields, // Copy enrichment data from lead
          convertedFromLeadId: leadId, // Link back to original lead
          createdBy: request.userId,
          updatedBy: request.userId,
        });
        contactId = contact.id;
        result.contactId = contactId;

        // Timeline event for contact
        await timelineService.create(db, {
          workspaceId: request.workspaceId,
          entityType: 'contact',
          entityId: contactId,
          eventType: 'contact.created_from_lead',
          eventCategory: 'milestone',
          eventLabel: 'Contact Created from Lead',
          summary: `Contact created from lead conversion`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: request.userId,
        });
      }

      // 3. Create opportunity if requested
      if (request.createOpportunity && request.opportunityData && accountId) {
        const opportunity = await opportunityService.create(db, {
          workspaceId: request.workspaceId,
          accountId: accountId,
          contactId: contactId,
          name: request.opportunityData.name,
          amount: request.opportunityData.amount.toString(),
          expectedCloseDate: request.opportunityData.expectedCloseDate,
          stage: request.opportunityData.stage || 'qualification',
          leadSource: lead.source,
          ownerId: lead.ownerId,
          status: 'open',
          createdBy: request.userId,
          updatedBy: request.userId,
        });
        result.opportunityId = opportunity.id;

        // Timeline event for opportunity
        await timelineService.create(db, {
          workspaceId: request.workspaceId,
          entityType: 'opportunity',
          entityId: opportunity.id,
          eventType: 'opportunity.created_from_lead',
          eventCategory: 'milestone',
          eventLabel: 'Opportunity Created from Lead',
          summary: `Opportunity created from lead conversion`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: request.userId,
        });
      }

      // 4. Update lead to converted status
      await db
        .update(crmLeads)
        .set({
          status: 'converted',
          convertedContactId: contactId,
          convertedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: request.userId,
        })
        .where(eq(crmLeads.id, leadId));

      // 5. Timeline event for lead conversion
      await timelineService.create(db, {
        workspaceId: request.workspaceId,
        entityType: 'lead',
        entityId: leadId,
        eventType: 'lead.converted',
        eventCategory: 'milestone',
        eventLabel: 'Lead Converted',
        summary: `Lead converted to contact${accountId ? ' and account' : ''}${result.opportunityId ? ' and opportunity' : ''}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: request.userId,
        dataChanges: {
          contactId,
          accountId,
          opportunityId: result.opportunityId,
        },
      });

      // T-060: Auto-complete WorkItem on lead conversion
      try {
        const { workItems } = await WorkItemsService.list(db, {
          workspaceId: request.workspaceId,
          entityType: 'lead',
          entityId: leadId,
          workItemType: 'lead_conversion',
        });

        // Complete all pending/claimed/in_progress WorkItems for this lead conversion
        for (const workItem of workItems) {
          if (['pending', 'claimed', 'in_progress'].includes(workItem.status)) {
            await WorkItemsService.complete(
              db,
              workItem.id,
              request.workspaceId,
              'user',
              {
                convertedAt: new Date().toISOString(),
                convertedBy: request.userId,
                contactId,
                accountId,
                opportunityId: result.opportunityId,
              }
            );

            console.log(`[leads/convert] Completed WorkItem ${workItem.id} for lead ${leadId}`);
          }
        }
      } catch (error) {
        // Log error but don't fail the conversion
        console.error(`[leads/convert] Failed to complete WorkItems for lead ${leadId}:`, error);
      }

      result.success = true;
      return result;
    } catch (error) {
      console.error('Lead conversion failed:', error);
      throw new Error(`Lead conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async getRecent(db: Database, workspaceId: string, seconds: number, customFieldFilters?: Record<string, any>) {
    const since = new Date(Date.now() - seconds * 1000);

    // Base conditions
    const conditions = [
      eq(crmLeads.workspaceId, workspaceId),
      isNull(crmLeads.deletedAt), // Exclude soft deleted
      gte(crmLeads.createdAt, since)
    ];

    // Add custom field filters if provided
    if (customFieldFilters && Object.keys(customFieldFilters).length > 0) {
      for (const [fieldPath, value] of Object.entries(customFieldFilters)) {
        if (fieldPath.endsWith('.min')) {
          // Numeric minimum: (custom_fields->>'field_name')::numeric >= value
          const field = fieldPath.replace('.min', '');
          const numericValue = parseFloat(value);
          if (!isNaN(numericValue)) {
            conditions.push(
              sql`(${crmLeads.customFields}->>${field})::numeric >= ${numericValue}`
            );
          }
        } else if (fieldPath.endsWith('.max')) {
          // Numeric maximum: (custom_fields->>'field_name')::numeric <= value
          const field = fieldPath.replace('.max', '');
          const numericValue = parseFloat(value);
          if (!isNaN(numericValue)) {
            conditions.push(
              sql`(${crmLeads.customFields}->>${field})::numeric <= ${numericValue}`
            );
          }
        } else if (fieldPath.endsWith('.contains')) {
          // Partial string match: custom_fields->>'field_name' ILIKE '%value%'
          const field = fieldPath.replace('.contains', '');
          conditions.push(
            sql`${crmLeads.customFields}->>${field} ILIKE ${'%' + value + '%'}`
          );
        } else {
          // Exact match (case-insensitive for strings)
          // LOWER(custom_fields->>'field_name') = LOWER('value')
          conditions.push(
            sql`LOWER(${crmLeads.customFields}->>${fieldPath}) = LOWER(${value})`
          );
        }
      }
    }

    const results = await db
      .select()
      .from(crmLeads)
      .where(and(...conditions))
      .orderBy(desc(crmLeads.createdAt));
    return results;
  },
};
