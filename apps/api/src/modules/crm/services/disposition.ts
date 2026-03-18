/**
 * Disposition Service
 * Handles contact disposition updates (US-CRM-STATE-MACHINE T-012)
 */

import type { Database } from '@agios/db';
import { crmContacts, type ContactDisposition, type CrmContact } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { timelineService } from './timeline';

interface DispositionOptions {
  callbackDate?: Date;
  callbackNotes?: string;
  userId?: string;
}

export const dispositionService = {
  /**
   * Update contact disposition
   * - callback: requires callbackDate
   * - interested: can convert to opportunity
   * - not_interested: add to nurture
   * - do_not_contact: compliance block
   */
  async updateDisposition(
    db: Database,
    contactId: string,
    workspaceId: string,
    disposition: ContactDisposition,
    options?: DispositionOptions
  ): Promise<CrmContact> {
    // Get current contact state
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt)
        )
      );

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Validate disposition-specific requirements
    if (disposition === 'callback' && !options?.callbackDate) {
      throw new Error('Callback disposition requires callbackDate');
    }

    // Prevent changing from do_not_contact (compliance lock)
    if (contact.disposition === 'do_not_contact' && disposition !== 'do_not_contact') {
      throw new Error('Cannot change disposition from do_not_contact (compliance block)');
    }

    const now = new Date();

    // Prepare update data
    const updateData: any = {
      disposition,
      dispositionChangedAt: now,
      dispositionChangedBy: options?.userId,
      updatedAt: now,
      updatedBy: options?.userId,
    };

    // Handle callback-specific fields
    if (disposition === 'callback') {
      updateData.callbackDate = options?.callbackDate;
      updateData.callbackNotes = options?.callbackNotes;
    } else {
      // Clear callback fields for other dispositions
      updateData.callbackDate = null;
      updateData.callbackNotes = null;
    }

    // Handle do_not_contact status propagation
    if (disposition === 'do_not_contact') {
      updateData.status = 'do_not_contact';
    }

    // Update contact
    const [updated] = await db
      .update(crmContacts)
      .set(updateData)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to update contact disposition');
    }

    // Create timeline event
    const eventCategory =
      disposition === 'do_not_contact' ? 'compliance' :
      disposition === 'interested' ? 'milestone' :
      'communication';

    const eventLabel =
      disposition === 'callback' ? 'Callback Scheduled' :
      disposition === 'interested' ? 'Interest Expressed' :
      disposition === 'not_interested' ? 'Not Interested' :
      'Do Not Contact';

    let summary = `Contact disposition changed to: ${disposition}`;
    if (disposition === 'callback' && options?.callbackDate) {
      summary += ` on ${options.callbackDate.toISOString()}`;
    }

    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: contactId,
      eventType: `contact.disposition_${disposition}`,
      eventCategory,
      eventLabel,
      summary,
      description: disposition === 'callback' ? options?.callbackNotes : undefined,
      occurredAt: now,
      actorType: options?.userId ? 'user' : 'system',
      actorId: options?.userId,
      dataChanges: {
        oldDisposition: contact.disposition,
        newDisposition: disposition,
        callbackDate: disposition === 'callback' ? options?.callbackDate : undefined,
      },
    });

    return updated;
  },
};
