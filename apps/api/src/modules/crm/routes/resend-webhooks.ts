/**
 * Resend Webhook Routes
 * Handle incoming webhooks from Resend for email tracking
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { crmCampaignRecipients, crmDripEnrollments, crmCampaignMessages, crmActivities, crmLeads } from '@agios/db';
import { eq, and } from 'drizzle-orm';
import { timelineService } from '../services/timeline';
import { dripService } from '../services/drip';
import { EmailSuppressionService } from '../services/email-suppression.service';

export const resendWebhookRoutes = new Elysia({ prefix: '/webhooks/resend' })

  // Unified webhook endpoint for all Resend events
  .post('/', async ({ body, request, set }) => {
    const event = body as {
      type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.opened' | 'email.clicked' | 'email.delivery_delayed' | 'email.received';
      created_at: string;
      data: {
        email_id: string;
        to: string;
        from: string;
        subject?: string;
        html?: string;
        text?: string;
        bounce?: {
          type: 'hard_bounce' | 'soft_bounce' | 'spam_complaint';
          description: string;
        };
        click?: {
          link: string;
        };
        tags?: {
          campaign_id?: string;
          message_id?: string;
          recipient_id?: string;
          workspace_id?: string;
          lead_id?: string;
          contact_id?: string;
        };
      };
    };

    console.log('[Resend Webhook] Received event:', event.type, 'email_id:', event.data.email_id);

    // Handle inbound emails (email.received)
    if (event.type === 'email.received') {
      return await handleInboundEmail(event);
    }

    // Try to find campaign recipient first
    const recipients = await db
      .select()
      .from(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.resendEmailId, event.data.email_id))
      .limit(1);

    const recipient = recipients[0];

    // If not a campaign email, check if it's a lead action email
    if (!recipient) {
      const activities = await db
        .select()
        .from(crmActivities)
        .where(eq(crmActivities.channelMessageId, event.data.email_id))
        .limit(1);

      const activity = activities[0];

      if (activity) {
        // Handle lead action email events
        await handleActivityEmailEvent(activity, event);
        return { received: true, type: 'activity_email' };
      }

      console.warn(`[Resend Webhook] No recipient or activity found for email_id: ${event.data.email_id}`);
      return { received: true, warning: 'Email not found' };
    }

    // Handle different event types
    switch (event.type) {
      case 'email.delivered':
        await db.update(crmCampaignRecipients).set({
          status: 'delivered',
          deliveredAt: new Date(event.created_at),
        }).where(eq(crmCampaignRecipients.id, recipient.id));

        await timelineService.create(db, {
          workspaceId: recipient.workspaceId,
          entityType: 'contact',
          entityId: recipient.contactId,
          eventType: 'campaign.email_delivered',
          eventCategory: 'communication',
          eventLabel: 'Email Delivered',
          summary: `Email delivered to ${event.data.to}`,
          occurredAt: new Date(event.created_at),
          actorType: 'system',
          actorId: null,
          actorName: 'Resend',
          metadata: {
            recipient_id: recipient.id,
            email_id: event.data.email_id,
            campaign_id: recipient.campaignId,
          },
        });
        break;

      case 'email.bounced':
        await db.update(crmCampaignRecipients).set({
          status: 'bounced',
          bounceType: event.data.bounce?.type,
          bounceDescription: event.data.bounce?.description,
        }).where(eq(crmCampaignRecipients.id, recipient.id));

        // Phase P: Auto-suppress based on bounce type
        if (event.data.bounce?.type === 'hard_bounce') {
          await EmailSuppressionService.suppress({
            workspaceId: recipient.workspaceId,
            email: event.data.to,
            reason: 'hard_bounce',
            reasonDetail: event.data.bounce?.description,
            sourceType: 'webhook',
            sourceCampaignId: recipient.campaignId,
            sourceRecipientId: recipient.id,
          });
        } else if (event.data.bounce?.type === 'soft_bounce') {
          // Track soft bounces and convert after threshold
          await EmailSuppressionService.recordSoftBounce({
            workspaceId: recipient.workspaceId,
            email: event.data.to,
            description: event.data.bounce?.description,
            sourceCampaignId: recipient.campaignId,
            sourceRecipientId: recipient.id,
          });
        } else if (event.data.bounce?.type === 'spam_complaint') {
          await EmailSuppressionService.suppress({
            workspaceId: recipient.workspaceId,
            email: event.data.to,
            reason: 'spam_complaint',
            reasonDetail: event.data.bounce?.description,
            sourceType: 'webhook',
            sourceCampaignId: recipient.campaignId,
            sourceRecipientId: recipient.id,
          });
        }

        await timelineService.create(db, {
          workspaceId: recipient.workspaceId,
          entityType: 'contact',
          entityId: recipient.contactId,
          eventType: 'campaign.email_bounced',
          eventCategory: 'communication',
          eventLabel: 'Email Bounced',
          summary: `Email bounced: ${event.data.bounce?.type}`,
          occurredAt: new Date(event.created_at),
          actorType: 'system',
          actorId: null,
          actorName: 'Resend',
          metadata: {
            recipient_id: recipient.id,
            bounce_type: event.data.bounce?.type,
            description: event.data.bounce?.description,
            campaign_id: recipient.campaignId,
          },
        });
        break;

      case 'email.opened':
        // Increment open count
        const currentOpenCount = recipient.openCount || 0;
        const isFirstOpen = !recipient.firstOpenedAt;

        await db.update(crmCampaignRecipients).set({
          firstOpenedAt: isFirstOpen ? new Date(event.created_at) : recipient.firstOpenedAt,
          openCount: currentOpenCount + 1,
        }).where(eq(crmCampaignRecipients.id, recipient.id));

        // Only create timeline event for first open
        if (isFirstOpen) {
          await timelineService.create(db, {
            workspaceId: recipient.workspaceId,
            entityType: 'contact',
            entityId: recipient.contactId,
            eventType: 'campaign.email_opened',
            eventCategory: 'communication',
            eventLabel: 'Email Opened',
            summary: `${event.data.to} opened email`,
            occurredAt: new Date(event.created_at),
            actorType: 'system', // Contact action recorded via webhook (valid enum: user/system/integration)
            actorId: null,
            actorName: event.data.to,
            metadata: {
              recipient_id: recipient.id,
              campaign_id: recipient.campaignId,
              contact_id: recipient.contactId,
            },
          });
        }

        // Check for drip campaign action triggers (opened)
        await checkDripActionTriggers(recipient, 'opened');
        break;

      case 'email.clicked':
        // Increment click count
        const currentClickCount = recipient.clickCount || 0;
        const isFirstClick = !recipient.firstClickedAt;

        await db.update(crmCampaignRecipients).set({
          firstClickedAt: isFirstClick ? new Date(event.created_at) : recipient.firstClickedAt,
          clickCount: currentClickCount + 1,
        }).where(eq(crmCampaignRecipients.id, recipient.id));

        // Create timeline event for each click (including link)
        await timelineService.create(db, {
          workspaceId: recipient.workspaceId,
          entityType: 'contact',
          entityId: recipient.contactId,
          eventType: 'campaign.email_clicked',
          eventCategory: 'communication',
          eventLabel: 'Email Link Clicked',
          summary: `${event.data.to} clicked link: ${event.data.click?.link || 'unknown'}`,
          occurredAt: new Date(event.created_at),
          actorType: 'system', // Contact action recorded via webhook (valid enum: user/system/integration)
          actorId: null,
          actorName: event.data.to,
          metadata: {
            recipient_id: recipient.id,
            link: event.data.click?.link,
            campaign_id: recipient.campaignId,
            contact_id: recipient.contactId,
          },
        });

        // Check for drip campaign action triggers (clicked)
        await checkDripActionTriggers(recipient, 'clicked');
        break;

      case 'email.delivery_delayed':
        // Log delivery delay but don't change status
        console.log(`[Resend Webhook] Email delivery delayed for ${event.data.to}`);
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }, {
    body: t.Object({
      type: t.String(),
      created_at: t.String(),
      data: t.Any(),
    }),
    detail: {
      tags: ['Webhooks'],
      summary: 'Resend webhook handler',
      description: 'Handle all Resend email events (delivered, bounced, opened, clicked)',
    },
  });

/**
 * Check if any drip enrollments are waiting for this action trigger
 */
async function checkDripActionTriggers(recipient: any, action: 'opened' | 'clicked'): Promise<void> {
  try {
    // Find active drip enrollments for this recipient
    const enrollments = await db
      .select()
      .from(crmDripEnrollments)
      .where(
        and(
          eq(crmDripEnrollments.recipientId, recipient.id),
          eq(crmDripEnrollments.status, 'active')
        )
      );

    if (enrollments.length === 0) {
      return; // No active drip enrollments
    }

    console.log(`[Resend Webhook] Checking ${enrollments.length} drip enrollments for ${action} trigger`);

    // For each enrollment, check if the next message is waiting for this action
    for (const enrollment of enrollments) {
      if (!enrollment.nextMessageId) {
        continue;
      }

      // Get the next message
      const nextMessage = await db.query.crmCampaignMessages.findFirst({
        where: (messages, { eq }) => eq(messages.id, enrollment.nextMessageId!),
      });

      if (!nextMessage) {
        continue;
      }

      // Check if this message is action-based and waiting for this action
      if (nextMessage.triggerType === 'action_based' && nextMessage.triggerAction === action) {
        console.log(
          `[Resend Webhook] Action trigger met for enrollment ${enrollment.id}: ${action}`
        );

        // Recalculate schedule - action trigger is now met, use delay_amount instead of fallback
        const delay = nextMessage.delayAmount || 0;
        const unit = nextMessage.delayUnit || 'days';
        const scheduledAt = calculateScheduledTime(delay, unit);

        // Update enrollment with new scheduled time
        await db
          .update(crmDripEnrollments)
          .set({
            nextScheduledAt: scheduledAt,
            updatedAt: new Date(),
          })
          .where(eq(crmDripEnrollments.id, enrollment.id));

        // Create timeline event
        await timelineService.create(db, {
          workspaceId: enrollment.workspaceId,
          entityType: 'contact',
          entityId: enrollment.contactId,
          eventType: 'campaign.drip_action_triggered',
          eventCategory: 'system',
          eventLabel: 'Drip Action Triggered',
          summary: `Drip action trigger "${action}" met, next message rescheduled`,
          occurredAt: new Date(),
          actorType: 'system',
          actorId: null,
          actorName: 'Webhook Handler',
          metadata: {
            enrollmentId: enrollment.id,
            campaignId: enrollment.campaignId,
            action,
            nextMessageId: nextMessage.id,
            rescheduledTo: scheduledAt.toISOString(),
          },
        });

        console.log(
          `[Resend Webhook] Rescheduled next message for enrollment ${enrollment.id} to ${scheduledAt.toISOString()}`
        );
      }
    }
  } catch (error) {
    console.error('[Resend Webhook] Error checking drip action triggers:', error);
    // Don't throw - webhook should still succeed
  }
}

/**
 * Calculate scheduled time based on delay amount and unit
 */
function calculateScheduledTime(amount: number, unit: string): Date {
  const now = new Date();
  const milliseconds = convertToMilliseconds(amount, unit);
  return new Date(now.getTime() + milliseconds);
}

/**
 * Convert delay amount and unit to milliseconds
 */
function convertToMilliseconds(amount: number, unit: string): number {
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
 * Handle inbound emails (email.received)
 */
async function handleInboundEmail(event: any): Promise<any> {
  try {
    const fromEmail = event.data.from;
    const toEmail = event.data.to;
    const subject = event.data.subject || '(No Subject)';
    const htmlContent = event.data.html || '';
    const textContent = event.data.text || '';

    console.log(`[Resend Webhook] Handling inbound email from ${fromEmail} to ${toEmail}`);

  // Try to find lead by email address
  const leads = await db
    .select()
    .from(crmLeads)
    .where(eq(crmLeads.email, fromEmail))
    .limit(1);

  const lead = leads[0];

  if (!lead) {
    console.warn(`[Resend Webhook] No lead found for email: ${fromEmail}`);
    return { received: true, warning: 'Lead not found' };
  }

    // Create activity for inbound email
    const activity = await db
      .insert(crmActivities)
      .values({
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        assigneeId: lead.createdBy, // Use lead's creator as assignee
        type: 'email',
        direction: 'inbound',
        channel: 'email',
        subject: subject,
        description: textContent.substring(0, 500),
        status: 'completed',
        channelMessageId: event.data.email_id,
        channelStatus: 'received',
        channelMetadata: {
          emailAddress: fromEmail,
          provider: 'resend',
          htmlContent: htmlContent,
          textContent: textContent,
          receivedAt: event.created_at,
        },
      })
      .returning();

    console.log(`[Resend Webhook] Created inbound activity ${activity[0].id} for lead ${lead.id}`);

    // Create timeline event
    await timelineService.create(db, {
      workspaceId: lead.workspaceId,
      entityType: 'lead',
      entityId: lead.id,
      eventType: 'activity.email_received',
      eventCategory: 'communication',
      eventLabel: 'Email Received',
      summary: `Received email: ${subject}`,
      occurredAt: new Date(event.created_at),
      actorType: 'integration', // Email came from external source
      actorId: null,
      actorName: fromEmail,
      metadata: {
        activityId: activity[0].id,
        emailId: event.data.email_id,
        from: fromEmail,
      },
    });

  // Update lead's last contact date and status to contacted
  await db
    .update(crmLeads)
    .set({
      lastContactDate: new Date(),
      status: 'contacted', // Automatically mark as contacted when inbound email received
      updatedAt: new Date(),
    })
    .where(eq(crmLeads.id, lead.id));

    return {
      received: true,
      type: 'inbound_email',
      leadId: lead.id,
      activityId: activity[0].id,
    };
  } catch (error) {
    console.error('[Resend Webhook] Error handling inbound email:', error);
    console.error('[Resend Webhook] Event data:', JSON.stringify(event, null, 2));
    throw error; // Re-throw to get proper 500 response
  }
}

/**
 * Handle email events for lead/contact activity emails
 */
async function handleActivityEmailEvent(activity: any, event: any): Promise<void> {
  const eventType = event.type;
  const emailId = event.data.email_id;

  console.log(`[Resend Webhook] Processing ${eventType} for activity ${activity.id}`);

  // Update activity metadata with email event data
  const currentMetadata = activity.channelMetadata || {};
  const eventHistory = currentMetadata.events || [];

  // Add new event to history
  eventHistory.push({
    type: eventType,
    timestamp: event.created_at,
    data: event.data,
  });

  // Update status based on event type
  let newStatus = activity.channelStatus;
  let newMetadata = {
    ...currentMetadata,
    events: eventHistory,
    lastEvent: eventType,
    lastEventAt: event.created_at,
  };

  switch (eventType) {
    case 'email.delivered':
      newStatus = 'delivered';
      newMetadata.deliveredAt = event.created_at;
      break;

    case 'email.bounced':
      newStatus = 'bounced';
      newMetadata.bounceType = event.data.bounce?.type;
      newMetadata.bounceDescription = event.data.bounce?.description;

      // Phase P: Auto-suppress on activity email bounce
      if (event.data.bounce?.type === 'hard_bounce') {
        await EmailSuppressionService.suppress({
          workspaceId: activity.workspaceId,
          email: event.data.to,
          reason: 'hard_bounce',
          reasonDetail: event.data.bounce?.description,
          sourceType: 'webhook',
        });
      } else if (event.data.bounce?.type === 'spam_complaint') {
        await EmailSuppressionService.suppress({
          workspaceId: activity.workspaceId,
          email: event.data.to,
          reason: 'spam_complaint',
          reasonDetail: event.data.bounce?.description,
          sourceType: 'webhook',
        });
      } else if (event.data.bounce?.type === 'soft_bounce') {
        await EmailSuppressionService.recordSoftBounce({
          workspaceId: activity.workspaceId,
          email: event.data.to,
          description: event.data.bounce?.description,
        });
      }
      break;

    case 'email.opened':
      const openCount = (currentMetadata.openCount || 0) + 1;
      newMetadata.openCount = openCount;
      if (!currentMetadata.firstOpenedAt) {
        newMetadata.firstOpenedAt = event.created_at;
      }
      break;

    case 'email.clicked':
      const clickCount = (currentMetadata.clickCount || 0) + 1;
      newMetadata.clickCount = clickCount;
      newMetadata.lastClickedLink = event.data.click?.link;
      if (!currentMetadata.firstClickedAt) {
        newMetadata.firstClickedAt = event.created_at;
      }
      break;
  }

  // Update activity in database
  await db
    .update(crmActivities)
    .set({
      channelStatus: newStatus,
      channelMetadata: newMetadata,
      updatedAt: new Date(),
    })
    .where(eq(crmActivities.id, activity.id));

  // Create timeline event for significant actions
  if (eventType === 'email.opened' || eventType === 'email.clicked' || eventType === 'email.bounced') {
    const entityType = activity.leadId ? 'lead' : activity.contactId ? 'contact' : null;
    const entityId = activity.leadId || activity.contactId;

    if (entityType && entityId) {
      await timelineService.create(db, {
        workspaceId: activity.workspaceId,
        entityType,
        entityId,
        eventType: `activity.email_${eventType.replace('email.', '')}`,
        eventCategory: 'communication',
        eventLabel: `Email ${eventType.replace('email.', '')}`,
        summary: getSummaryForEvent(eventType, event.data),
        occurredAt: new Date(event.created_at),
        actorType: 'system', // Valid enum: user/system/integration
        actorId: null,
        actorName: event.data.to,
        metadata: {
          activityId: activity.id,
          emailId: emailId,
          eventType: eventType,
          [entityType === 'lead' ? 'lead_id' : 'contact_id']: entityId,
        },
      });
    }
  }

  console.log(`[Resend Webhook] Updated activity ${activity.id} with ${eventType}`);
}

/**
 * Get human-readable summary for email event
 */
function getSummaryForEvent(eventType: string, data: any): string {
  switch (eventType) {
    case 'email.opened':
      return `${data.to} opened email`;
    case 'email.clicked':
      return `${data.to} clicked link: ${data.click?.link || 'unknown'}`;
    case 'email.bounced':
      return `Email bounced: ${data.bounce?.type || 'unknown'}`;
    case 'email.delivered':
      return `Email delivered to ${data.to}`;
    default:
      return `Email event: ${eventType}`;
  }
}
