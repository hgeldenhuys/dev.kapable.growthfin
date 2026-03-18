/**
 * Compliance Block Service
 * Handles do_not_contact enforcement with entity propagation (US-CRM-STATE-MACHINE T-014)
 */

import type { Database } from '@agios/db';
import { crmLeads, crmContacts, crmOpportunities } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { timelineService } from './timeline';

type RequestedBy = 'consumer' | 'system' | 'legal';

export const complianceBlockService = {
  /**
   * Apply compliance block (do_not_contact) to entity
   * - Propagates to related entities (e.g., lead → contact → opportunity)
   * - Creates timeline entry for audit
   */
  async applyComplianceBlock(
    db: Database,
    entityType: 'lead' | 'contact',
    entityId: string,
    workspaceId: string,
    reason: string,
    requestedBy: RequestedBy,
    userId?: string
  ): Promise<void> {
    const now = new Date();

    if (entityType === 'lead') {
      // Block lead
      const [lead] = await db
        .select()
        .from(crmLeads)
        .where(
          and(
            eq(crmLeads.id, entityId),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        );

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Update lead to do_not_contact
      await db
        .update(crmLeads)
        .set({
          contactability: 'do_not_contact',
          status: 'do_not_contact',
          updatedAt: now,
          updatedBy: userId,
        })
        .where(
          and(
            eq(crmLeads.id, entityId),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        );

      // Create timeline event
      await timelineService.create(db, {
        workspaceId,
        entityType: 'lead',
        entityId,
        eventType: 'lead.compliance_block',
        eventCategory: 'compliance',
        eventLabel: 'Do Not Contact Applied',
        summary: `Compliance block applied by ${requestedBy}: ${reason}`,
        description: reason,
        occurredAt: now,
        actorType: userId ? 'user' : 'system',
        actorId: userId,
        dataChanges: {
          requestedBy,
          reason,
        },
      });

      // If lead has converted contact, block it too
      if (lead.convertedContactId) {
        await this.applyComplianceBlock(
          db,
          'contact',
          lead.convertedContactId,
          workspaceId,
          `Propagated from lead: ${reason}`,
          requestedBy,
          userId
        );
      }
    } else if (entityType === 'contact') {
      // Block contact
      const [contact] = await db
        .select()
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.id, entityId),
            eq(crmContacts.workspaceId, workspaceId),
            isNull(crmContacts.deletedAt)
          )
        );

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Update contact to do_not_contact
      await db
        .update(crmContacts)
        .set({
          status: 'do_not_contact',
          disposition: 'do_not_contact',
          dispositionChangedAt: now,
          dispositionChangedBy: userId,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(
          and(
            eq(crmContacts.id, entityId),
            eq(crmContacts.workspaceId, workspaceId),
            isNull(crmContacts.deletedAt)
          )
        );

      // Create timeline event
      await timelineService.create(db, {
        workspaceId,
        entityType: 'contact',
        entityId,
        eventType: 'contact.compliance_block',
        eventCategory: 'compliance',
        eventLabel: 'Do Not Contact Applied',
        summary: `Compliance block applied by ${requestedBy}: ${reason}`,
        description: reason,
        occurredAt: now,
        actorType: userId ? 'user' : 'system',
        actorId: userId,
        dataChanges: {
          requestedBy,
          reason,
        },
      });

      // Close all open opportunities for this contact
      const openOpportunities = await db
        .select()
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.contactId, entityId),
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.outcome, 'open'),
            isNull(crmOpportunities.deletedAt)
          )
        );

      for (const opportunity of openOpportunities) {
        // Close opportunity as lost due to compliance
        await db
          .update(crmOpportunities)
          .set({
            outcome: 'lost',
            status: 'lost',
            stage: 'closed_lost',
            lostReason: 'other',
            lostNotes: `Closed due to compliance block: ${reason}`,
            actualCloseDate: now,
            closedBy: userId,
            updatedAt: now,
            updatedBy: userId,
          })
          .where(
            and(
              eq(crmOpportunities.id, opportunity.id),
              eq(crmOpportunities.workspaceId, workspaceId)
            )
          );

        // Create timeline event for opportunity
        await timelineService.create(db, {
          workspaceId,
          entityType: 'opportunity',
          entityId: opportunity.id,
          eventType: 'opportunity.compliance_closed',
          eventCategory: 'compliance',
          eventLabel: 'Closed Due to Compliance',
          summary: `Opportunity closed due to compliance block on contact`,
          description: reason,
          occurredAt: now,
          actorType: userId ? 'user' : 'system',
          actorId: userId,
          dataChanges: {
            requestedBy,
            reason,
          },
        });
      }
    }
  },

  /**
   * Check if entity is blocked
   */
  async isBlocked(
    db: Database,
    entityType: 'lead' | 'contact',
    entityId: string,
    workspaceId: string
  ): Promise<boolean> {
    if (entityType === 'lead') {
      const [lead] = await db
        .select()
        .from(crmLeads)
        .where(
          and(
            eq(crmLeads.id, entityId),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        );

      return lead?.contactability === 'do_not_contact' || lead?.status === 'do_not_contact';
    } else {
      const [contact] = await db
        .select()
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.id, entityId),
            eq(crmContacts.workspaceId, workspaceId),
            isNull(crmContacts.deletedAt)
          )
        );

      return contact?.status === 'do_not_contact' || contact?.disposition === 'do_not_contact';
    }
  },
};
