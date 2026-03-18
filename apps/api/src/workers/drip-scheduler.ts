/**
 * Drip Scheduler Worker
 * Processes active drip enrollments and sends scheduled messages
 */

import { db } from '@agios/db';
import { crmDripEnrollments, crmCampaignMessages, crmCampaignRecipients } from '@agios/db';
import { eq, and, lte, isNull } from 'drizzle-orm';
import { jobQueue, type ExecuteCampaignJob } from '../lib/queue';
import { timelineService } from '../modules/crm/services/timeline';
import { dripService } from '../modules/crm/services/drip';

/**
 * Check for drip enrollments that are due for sending
 */
export async function checkDueEnrollments(): Promise<void> {
  const now = new Date();

  console.log('[Drip Scheduler] Checking for due enrollments...');

  try {
    // Find enrollments that are:
    // - status = 'active'
    // - next_scheduled_at <= NOW()
    const dueEnrollments = await db
      .select()
      .from(crmDripEnrollments)
      .where(
        and(
          eq(crmDripEnrollments.status, 'active'),
          lte(crmDripEnrollments.nextScheduledAt, now)
        )
      );

    console.log(`[Drip Scheduler] Found ${dueEnrollments.length} enrollments due for sending`);

    for (const enrollment of dueEnrollments) {
      try {
        await processDripEnrollment(enrollment);
      } catch (error) {
        console.error(`[Drip Scheduler] Error processing enrollment ${enrollment.id}:`, error);

        // Mark enrollment as failed
        await db
          .update(crmDripEnrollments)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(crmDripEnrollments.id, enrollment.id));
      }
    }

    console.log('[Drip Scheduler] Completed check');
  } catch (error) {
    console.error('[Drip Scheduler] Error checking due enrollments:', error);
    throw error;
  }
}

/**
 * Process a single drip enrollment
 */
async function processDripEnrollment(enrollment: any): Promise<void> {
  console.log(`[Drip Scheduler] Processing enrollment ${enrollment.id}, step ${enrollment.currentSequenceStep}`);

  // Get the message to send
  if (!enrollment.nextMessageId) {
    console.warn(`[Drip Scheduler] No next message for enrollment ${enrollment.id}, completing...`);
    await dripService.completeEnrollment(db, enrollment.id);
    return;
  }

  // Get message details
  const message = await db.query.crmCampaignMessages.findFirst({
    where: (messages, { eq }) => eq(messages.id, enrollment.nextMessageId),
  });

  if (!message) {
    console.warn(`[Drip Scheduler] Message ${enrollment.nextMessageId} not found, skipping to next...`);

    // Message deleted - skip to next message
    await dripService.scheduleNextMessage(db, enrollment.id);

    // Create timeline event for skipped message
    await timelineService.create(db, {
      workspaceId: enrollment.workspaceId,
      entityType: 'contact',
      entityId: enrollment.contactId,
      eventType: 'campaign.drip_message_skipped',
      eventCategory: 'system',
      eventLabel: 'Drip Message Skipped',
      summary: `Drip message skipped (deleted), moving to next in sequence`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'Drip Scheduler',
      metadata: {
        enrollmentId: enrollment.id,
        campaignId: enrollment.campaignId,
        sequenceStep: enrollment.currentSequenceStep,
        messageId: enrollment.nextMessageId,
      },
    });

    return;
  }

  // Check if message is action-based and if action is met
  if (message.triggerType === 'action_based') {
    const actionMet = await dripService.checkActionTrigger(
      db,
      enrollment.id,
      message.triggerAction,
      message.triggerMessageId
    );

    console.log(`[Drip Scheduler] Action-based trigger: ${message.triggerAction}, met: ${actionMet}`);

    // If action not met and we've passed fallback timeout, send anyway
    if (!actionMet) {
      const enrolledTime = enrollment.enrolledAt.getTime();
      const fallbackMs = (message.fallbackDelayDays || 7) * 24 * 60 * 60 * 1000;
      const now = Date.now();

      if (now < enrolledTime + fallbackMs) {
        console.log(`[Drip Scheduler] Action not met and fallback timeout not reached, skipping for now`);
        return; // Don't send yet, wait for fallback timeout
      }

      console.log(`[Drip Scheduler] Action not met but fallback timeout reached, sending anyway`);
    }
  }

  // Get recipient to send message to
  const recipient = await db.query.crmCampaignRecipients.findFirst({
    where: (recipients, { eq }) => eq(recipients.id, enrollment.recipientId),
  });

  if (!recipient) {
    console.error(`[Drip Scheduler] Recipient ${enrollment.recipientId} not found`);
    return;
  }

  // Enqueue send job using execute-campaign worker
  await jobQueue.send<ExecuteCampaignJob>(
    'execute-campaign',
    {
      campaignId: enrollment.campaignId,
      messageId: message.id,
      workspaceId: enrollment.workspaceId,
    },
    {
      priority: 1,
      retryLimit: 3,
    }
  );

  console.log(`[Drip Scheduler] Enqueued send job for message ${message.id}`);

  // Create timeline event for message sent
  await timelineService.create(db, {
    workspaceId: enrollment.workspaceId,
    entityType: 'contact',
    entityId: enrollment.contactId,
    eventType: 'campaign.drip_message_sent',
    eventCategory: 'system',
    eventLabel: 'Drip Message Sent',
    summary: `Drip sequence message ${enrollment.currentSequenceStep} sent: "${message.name}"`,
    occurredAt: new Date(),
    actorType: 'system',
    actorId: null,
    actorName: 'Drip Scheduler',
    metadata: {
      enrollmentId: enrollment.id,
      campaignId: enrollment.campaignId,
      messageId: message.id,
      messageName: message.name,
      sequenceStep: enrollment.currentSequenceStep,
      triggerType: message.triggerType,
      triggerAction: message.triggerAction,
    },
  });

  // Calculate and schedule next message
  const nextMessage = await dripService.calculateNextMessage(db, enrollment.id);

  if (!nextMessage) {
    // No more messages - complete enrollment
    await dripService.completeEnrollment(db, enrollment.id);

    // Create timeline event for completion
    await timelineService.create(db, {
      workspaceId: enrollment.workspaceId,
      entityType: 'contact',
      entityId: enrollment.contactId,
      eventType: 'campaign.drip_enrollment_completed',
      eventCategory: 'system',
      eventLabel: 'Drip Sequence Completed',
      summary: `Completed drip sequence (${enrollment.currentSequenceStep} messages sent)`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'Drip Scheduler',
      metadata: {
        enrollmentId: enrollment.id,
        campaignId: enrollment.campaignId,
        totalSteps: enrollment.currentSequenceStep,
      },
    });

    console.log(`[Drip Scheduler] Enrollment ${enrollment.id} completed`);
  } else {
    // Update enrollment with next message
    await db
      .update(crmDripEnrollments)
      .set({
        nextMessageId: nextMessage.messageId,
        nextScheduledAt: nextMessage.scheduledAt,
        currentSequenceStep: enrollment.currentSequenceStep + 1,
        updatedAt: new Date(),
      })
      .where(eq(crmDripEnrollments.id, enrollment.id));

    console.log(
      `[Drip Scheduler] Scheduled next message for enrollment ${enrollment.id}, step ${enrollment.currentSequenceStep + 1} at ${nextMessage.scheduledAt.toISOString()}`
    );
  }
}

/**
 * Start the drip scheduler
 * Runs based on DRIP_SCHEDULER_INTERVAL_SECONDS env variable (default: 60 seconds)
 */
export async function startDripScheduler(): Promise<void> {
  const intervalSeconds = parseInt(process.env.DRIP_SCHEDULER_INTERVAL_SECONDS || '60', 10);
  const intervalMs = intervalSeconds * 1000;

  console.log(`[Drip Scheduler] Starting scheduler (runs every ${intervalSeconds} seconds)...`);

  // Run immediately on startup
  await checkDueEnrollments();

  // Then run on interval
  setInterval(async () => {
    try {
      await checkDueEnrollments();
    } catch (error) {
      console.error('[Drip Scheduler] Interval check failed:', error);
    }
  }, intervalMs);

  console.log('[Drip Scheduler] Scheduler started');
}
