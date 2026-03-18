/**
 * Drip Campaign Service
 * Business logic for drip sequence management and enrollment
 */

import type { Database } from '@agios/db';
import {
  crmDripEnrollments,
  crmCampaignMessages,
  crmCampaignRecipients,
  crmCampaigns,
  type DripDelayUnit,
  type DripTriggerAction,
} from '@agios/db';
import { eq, and, lte, isNull } from 'drizzle-orm';

interface NextMessage {
  messageId: string;
  scheduledAt: Date;
}

/**
 * Enroll a recipient in a drip sequence
 */
export async function enrollRecipient(
  db: Database,
  campaignId: string,
  recipientId: string,
  workspaceId: string
): Promise<any> {
  // Get recipient with contact
  const recipient = await db.query.crmCampaignRecipients.findFirst({
    where: (recipients, { eq, and }) =>
      and(eq(recipients.id, recipientId), eq(recipients.workspaceId, workspaceId)),
    with: {
      contact: true,
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  // Get first message in sequence (sequence_order = 1)
  const firstMessage = await db.query.crmCampaignMessages.findFirst({
    where: (messages, { eq, and, isNull }) =>
      and(
        eq(messages.campaignId, campaignId),
        eq(messages.sequenceOrder, 1),
        isNull(messages.deletedAt)
      ),
  });

  if (!firstMessage) {
    throw new Error('No first message found in drip sequence');
  }

  // Calculate next scheduled time for first message
  const nextScheduledAt = calculateScheduledTime(
    firstMessage.delayAmount || 0,
    firstMessage.delayUnit as DripDelayUnit
  );

  // Create enrollment
  const enrollment = await db
    .insert(crmDripEnrollments)
    .values({
      workspaceId,
      campaignId,
      recipientId,
      contactId: recipient.contactId,
      currentSequenceStep: 1,
      status: 'active',
      nextMessageId: firstMessage.id,
      nextScheduledAt,
      enrolledAt: new Date(),
    })
    .returning();

  return enrollment[0];
}

/**
 * Calculate the next message in sequence for an enrollment
 */
export async function calculateNextMessage(
  db: Database,
  enrollmentId: string
): Promise<NextMessage | null> {
  // Get enrollment with current state
  const enrollment = await db.query.crmDripEnrollments.findFirst({
    where: (enrollments, { eq }) => eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  // Get all messages for this campaign, ordered by sequence
  const messages = await db
    .select()
    .from(crmCampaignMessages)
    .where(
      and(
        eq(crmCampaignMessages.campaignId, enrollment.campaignId),
        isNull(crmCampaignMessages.deletedAt)
      )
    )
    .orderBy(crmCampaignMessages.sequenceOrder);

  const messagesWithSequence = messages.filter((m) => m.sequenceOrder !== null);

  if (messagesWithSequence.length === 0) {
    return null; // No more messages in sequence
  }

  // Find next message after current step
  const nextMessage = messagesWithSequence.find(
    (m) => m.sequenceOrder! > enrollment.currentSequenceStep
  );

  if (!nextMessage) {
    return null; // End of sequence
  }

  // Calculate scheduled time based on trigger type
  let scheduledAt: Date;

  if (nextMessage.triggerType === 'action_based') {
    // For action-based triggers, check if action was met
    const actionMet = await checkActionTrigger(
      db,
      enrollmentId,
      nextMessage.triggerAction as DripTriggerAction,
      nextMessage.triggerMessageId || null
    );

    if (actionMet) {
      // Action met - schedule based on delay_amount
      scheduledAt = calculateScheduledTime(
        nextMessage.delayAmount || 0,
        nextMessage.delayUnit as DripDelayUnit
      );
    } else {
      // Action not met - use fallback timeout
      scheduledAt = calculateScheduledTime(
        nextMessage.fallbackDelayDays || 7,
        'days'
      );
    }
  } else {
    // Time-based trigger
    scheduledAt = calculateScheduledTime(
      nextMessage.delayAmount || 0,
      nextMessage.delayUnit as DripDelayUnit
    );
  }

  return {
    messageId: nextMessage.id,
    scheduledAt,
  };
}

/**
 * Schedule the next message in sequence
 */
export async function scheduleNextMessage(
  db: Database,
  enrollmentId: string
): Promise<void> {
  const nextMessage = await calculateNextMessage(db, enrollmentId);

  if (!nextMessage) {
    // No more messages - mark enrollment as completed
    await completeEnrollment(db, enrollmentId);
    return;
  }

  // Get enrollment to increment step
  const enrollment = await db.query.crmDripEnrollments.findFirst({
    where: (enrollments, { eq }) => eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  // Update enrollment with next message
  await db
    .update(crmDripEnrollments)
    .set({
      nextMessageId: nextMessage.messageId,
      nextScheduledAt: nextMessage.scheduledAt,
      currentSequenceStep: enrollment.currentSequenceStep + 1,
      updatedAt: new Date(),
    })
    .where(eq(crmDripEnrollments.id, enrollmentId));
}

/**
 * Pause an enrollment (can be resumed)
 */
export async function pauseEnrollment(
  db: Database,
  enrollmentId: string
): Promise<any> {
  const enrollment = await db
    .update(crmDripEnrollments)
    .set({
      status: 'paused',
      pausedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(crmDripEnrollments.id, enrollmentId))
    .returning();

  if (enrollment.length === 0) {
    throw new Error('Enrollment not found');
  }

  return enrollment[0];
}

/**
 * Resume a paused enrollment
 */
export async function resumeEnrollment(
  db: Database,
  enrollmentId: string
): Promise<any> {
  const enrollment = await db.query.crmDripEnrollments.findFirst({
    where: (enrollments, { eq }) => eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  if (enrollment.status !== 'paused') {
    throw new Error('Enrollment is not paused');
  }

  // Calculate new scheduled time (maintain original delay from now)
  const newScheduledAt = enrollment.nextScheduledAt
    ? new Date(Date.now() + (enrollment.nextScheduledAt.getTime() - (enrollment.pausedAt?.getTime() || Date.now())))
    : new Date();

  const updated = await db
    .update(crmDripEnrollments)
    .set({
      status: 'active',
      pausedAt: null,
      nextScheduledAt: newScheduledAt,
      updatedAt: new Date(),
    })
    .where(eq(crmDripEnrollments.id, enrollmentId))
    .returning();

  return updated[0];
}

/**
 * Mark enrollment as completed
 */
export async function completeEnrollment(
  db: Database,
  enrollmentId: string
): Promise<any> {
  const enrollment = await db
    .update(crmDripEnrollments)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(crmDripEnrollments.id, enrollmentId))
    .returning();

  if (enrollment.length === 0) {
    throw new Error('Enrollment not found');
  }

  return enrollment[0];
}

/**
 * Unsubscribe a recipient from drip sequence
 */
export async function unsubscribeEnrollment(
  db: Database,
  enrollmentId: string
): Promise<any> {
  const enrollment = await db
    .update(crmDripEnrollments)
    .set({
      status: 'unsubscribed',
      updatedAt: new Date(),
    })
    .where(eq(crmDripEnrollments.id, enrollmentId))
    .returning();

  if (enrollment.length === 0) {
    throw new Error('Enrollment not found');
  }

  return enrollment[0];
}

/**
 * Check if an action trigger has been met
 */
export async function checkActionTrigger(
  db: Database,
  enrollmentId: string,
  action: DripTriggerAction | null,
  triggerMessageId: string | null
): Promise<boolean> {
  if (!action) {
    return false;
  }

  // Get enrollment
  const enrollment = await db.query.crmDripEnrollments.findFirst({
    where: (enrollments, { eq }) => eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    return false;
  }

  // Get recipient to check engagement
  const recipient = await db.query.crmCampaignRecipients.findFirst({
    where: (recipients, { eq }) => eq(recipients.id, enrollment.recipientId),
  });

  if (!recipient) {
    return false;
  }

  // Check action based on type
  switch (action) {
    case 'opened':
      return recipient.firstOpenedAt !== null;
    case 'clicked':
      return recipient.firstClickedAt !== null;
    case 'not_opened':
      return recipient.firstOpenedAt === null;
    case 'not_clicked':
      return recipient.firstClickedAt === null;
    default:
      return false;
  }
}

/**
 * Calculate scheduled time based on delay amount and unit
 */
function calculateScheduledTime(amount: number, unit: DripDelayUnit): Date {
  const now = new Date();
  const milliseconds = convertToMilliseconds(amount, unit);
  return new Date(now.getTime() + milliseconds);
}

/**
 * Convert delay amount and unit to milliseconds
 */
function convertToMilliseconds(amount: number, unit: DripDelayUnit): number {
  switch (unit) {
    case 'minutes':
      return amount * 60 * 1000;
    case 'hours':
      return amount * 60 * 60 * 1000;
    case 'days':
      return amount * 24 * 60 * 60 * 1000;
    case 'weeks':
      return amount * 7 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

/**
 * Pause all enrollments when campaign is paused
 */
export async function pauseAllEnrollments(
  db: Database,
  campaignId: string
): Promise<void> {
  await db
    .update(crmDripEnrollments)
    .set({
      status: 'paused',
      pausedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmDripEnrollments.campaignId, campaignId),
        eq(crmDripEnrollments.status, 'active')
      )
    );
}

/**
 * Resume all enrollments when campaign is reactivated
 */
export async function resumeAllEnrollments(
  db: Database,
  campaignId: string
): Promise<void> {
  // Get all paused enrollments
  const pausedEnrollments = await db
    .select()
    .from(crmDripEnrollments)
    .where(
      and(
        eq(crmDripEnrollments.campaignId, campaignId),
        eq(crmDripEnrollments.status, 'paused')
      )
    );

  // Resume each enrollment with recalculated schedule
  for (const enrollment of pausedEnrollments) {
    await resumeEnrollment(db, enrollment.id);
  }
}

export const dripService = {
  enrollRecipient,
  calculateNextMessage,
  scheduleNextMessage,
  pauseEnrollment,
  resumeEnrollment,
  completeEnrollment,
  unsubscribeEnrollment,
  checkActionTrigger,
  pauseAllEnrollments,
  resumeAllEnrollments,
};
