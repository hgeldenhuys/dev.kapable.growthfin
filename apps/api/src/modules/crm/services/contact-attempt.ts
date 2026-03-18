/**
 * Contact Attempt Service
 * Handles lead contact attempt logic with auto-blacklist (US-CRM-STATE-MACHINE T-010)
 */

import type { Database } from '@agios/db';
import { crmLeads, type BlacklistReason, type CrmLead } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { timelineService } from './timeline';
import { WorkItemsService } from '../../work-items/services/work-items.service';

export const contactAttemptService = {
  /**
   * Record a contact attempt and update contactability state
   * - no_party: increment attempts, blacklist if >= 3
   * - wrong_party: immediate blacklist
   * - right_party: proceed to qualification
   */
  async recordAttempt(
    db: Database,
    leadId: string,
    workspaceId: string,
    outcome: 'no_party' | 'wrong_party' | 'right_party',
    notes?: string,
    userId?: string
  ): Promise<CrmLead> {
    // Get current lead state
    const [lead] = await db
      .select()
      .from(crmLeads)
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      );

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Check if lead is already blacklisted or converted
    if (lead.contactability === 'blacklisted') {
      throw new Error('Lead is already blacklisted');
    }

    if (lead.contactability === 'converted') {
      throw new Error('Lead is already converted');
    }

    if (lead.contactability === 'do_not_contact') {
      throw new Error('Lead has do_not_contact status (compliance block)');
    }

    if (lead.contactability === 'right_party_contact') {
      throw new Error('Lead already has right party contact - proceed to conversion');
    }

    const now = new Date();
    const contactAttempts = (lead.contactAttempts || 0) + 1;

    let contactability = lead.contactability;
    let blacklistedAt = lead.blacklistedAt;
    let blacklistReason = lead.blacklistReason;
    let blacklistNotes = lead.blacklistNotes;

    // Determine new state based on outcome
    switch (outcome) {
      case 'no_party':
        // Increment attempts, blacklist if >= 3
        if (contactAttempts >= 3) {
          contactability = 'blacklisted';
          blacklistedAt = now;
          blacklistReason = 'max_contact_attempts';
          blacklistNotes = notes || 'Exceeded maximum contact attempts (3 attempts with no party contact)';
        } else {
          contactability = 'no_party_contact';
        }
        break;

      case 'wrong_party':
        // Immediate blacklist
        contactability = 'blacklisted';
        blacklistedAt = now;
        blacklistReason = 'wrong_party';
        blacklistNotes = notes || 'Wrong party contacted';
        break;

      case 'right_party':
        // Success - proceed to qualification
        contactability = 'right_party_contact';
        break;
    }

    // Update lead
    const [updated] = await db
      .update(crmLeads)
      .set({
        contactability,
        contactAttempts,
        lastContactAttempt: now,
        lastContactOutcome: JSON.stringify({ outcome, notes, timestamp: now.toISOString() }),
        blacklistedAt,
        blacklistReason,
        blacklistNotes,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to update lead');
    }

    // Create timeline event
    const eventLabel =
      outcome === 'no_party' ? 'No Party Contact' :
      outcome === 'wrong_party' ? 'Wrong Party Contact' :
      'Right Party Contact';

    const summary =
      contactability === 'blacklisted'
        ? `Lead blacklisted: ${blacklistReason} (attempt ${contactAttempts})`
        : `Contact attempt ${contactAttempts}: ${eventLabel}`;

    await timelineService.create(db, {
      workspaceId,
      entityType: 'lead',
      entityId: leadId,
      eventType: contactability === 'blacklisted' ? 'lead.blacklisted' : 'lead.contact_attempted',
      eventCategory: contactability === 'blacklisted' ? 'compliance' : 'communication',
      eventLabel,
      summary,
      description: notes,
      occurredAt: now,
      actorType: userId ? 'user' : 'system',
      actorId: userId,
      dataChanges: {
        outcome,
        contactAttempts,
        contactability,
        blacklistReason: contactability === 'blacklisted' ? blacklistReason : undefined,
      },
    });

    // T-059: Auto-create WorkItem on right_party_contact
    if (contactability === 'right_party_contact') {
      try {
        await WorkItemsService.create(db, {
          workspaceId,
          entityType: 'lead',
          entityId: leadId,
          workItemType: 'lead_conversion',
          title: `Convert Lead: ${lead.firstName} ${lead.lastName}`,
          description: `Lead reached right party contact - ready for conversion`,
          priority: 1,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          metadata: {
            leadId,
            source: 'contactability_update',
            contactAttempt: contactAttempts,
            timestamp: now.toISOString(),
          },
          createdBy: userId,
          updatedBy: userId,
        });

        console.log(`[contact-attempt] Created WorkItem for lead ${leadId} (right_party_contact)`);
      } catch (error) {
        // Log error but don't fail the contact attempt
        console.error(`[contact-attempt] Failed to create WorkItem for lead ${leadId}:`, error);
      }
    }

    return updated;
  },

  /**
   * Manually blacklist a lead with reason
   */
  async blacklistLead(
    db: Database,
    leadId: string,
    workspaceId: string,
    reason: BlacklistReason,
    notes?: string,
    userId?: string
  ): Promise<CrmLead> {
    // Get current lead state
    const [lead] = await db
      .select()
      .from(crmLeads)
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      );

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Check if lead is already blacklisted
    if (lead.contactability === 'blacklisted') {
      throw new Error('Lead is already blacklisted');
    }

    if (lead.contactability === 'converted') {
      throw new Error('Cannot blacklist a converted lead');
    }

    const now = new Date();

    // Update lead
    const [updated] = await db
      .update(crmLeads)
      .set({
        contactability: 'blacklisted',
        blacklistedAt: now,
        blacklistReason: reason,
        blacklistNotes: notes,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to blacklist lead');
    }

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'lead',
      entityId: leadId,
      eventType: 'lead.blacklisted',
      eventCategory: 'compliance',
      eventLabel: 'Lead Blacklisted',
      summary: `Lead manually blacklisted: ${reason}`,
      description: notes,
      occurredAt: now,
      actorType: userId ? 'user' : 'system',
      actorId: userId,
      dataChanges: {
        reason,
        notes,
      },
    });

    return updated;
  },
};
