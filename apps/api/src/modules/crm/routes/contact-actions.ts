/**
 * Contact Action Routes
 * Multi-channel communication endpoints (SMS, email) for contacts
 * Mirrors lead-actions.ts but for contacts entity
 */

import { Elysia, t } from 'elysia';
import { eq, and, isNull } from 'drizzle-orm';
import { crmContacts, crmActivities } from '@agios/db/schema';
import { getTwilioSMSAdapter, getTwilioWhatsAppAdapter, ResendAdapter } from '../../../lib/channels';
import { resolveOutboundNumber } from '../../../lib/utils/phone-validation';
import { getUserName } from '../../../lib/utils/user-lookup';
import type { Database } from '../../../db';

/**
 * Resolve template variables in text using entity data.
 * Supports: {{firstName}}, {{lastName}}, {{fullName}}, {{company}}, {{email}}, {{phone}}
 */
function resolveTemplateVars(
  text: string,
  entity: { firstName?: string; lastName?: string; companyName?: string; email?: string | null; phone?: string | null }
): string {
  const fullName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
  return text
    .replace(/\{\{firstName\}\}/gi, entity.firstName || '')
    .replace(/\{\{lastName\}\}/gi, entity.lastName || '')
    .replace(/\{\{fullName\}\}/gi, fullName)
    .replace(/\{\{company\}\}/gi, entity.companyName || '')
    .replace(/\{\{email\}\}/gi, entity.email || '')
    .replace(/\{\{phone\}\}/gi, entity.phone || '');
}

/**
 * Create activity record for a contact communication action
 */
async function createActivity(
  db: Database,
  params: {
    workspaceId: string;
    contactId: string;
    userId: string;
    type: 'call' | 'sms' | 'email';
    direction: 'inbound' | 'outbound';
    channel: string;
    subject: string;
    description?: string;
    channelMessageId?: string;
    channelStatus?: string;
    channelErrorCode?: string;
    channelMetadata?: Record<string, any>;
  }
) {
  const activity = await db
    .insert(crmActivities)
    .values({
      workspaceId: params.workspaceId,
      contactId: params.contactId,
      assigneeId: params.userId,
      type: params.type,
      direction: params.direction,
      channel: params.channel,
      subject: params.subject,
      description: params.description,
      status: 'planned',
      channelMessageId: params.channelMessageId,
      channelStatus: params.channelStatus,
      channelErrorCode: params.channelErrorCode,
      channelMetadata: params.channelMetadata || {},
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning();

  return activity[0];
}

/**
 * Get contact by ID with validation
 */
async function getContactWithValidation(
  db: Database,
  id: string,
  workspaceId: string
) {
  const contacts = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, id),
        eq(crmContacts.workspaceId, workspaceId),
        isNull(crmContacts.deletedAt)
      )
    )
    .limit(1);

  if (contacts.length === 0) {
    throw new Error('Contact not found');
  }

  return contacts[0];
}

export const contactActionRoutes = new Elysia({ prefix: '/contacts' })
  /**
   * POST /:id/send-sms - Send SMS to contact
   */
  .post(
    '/:id/send-sms',
    async ({ db, params, body, set }) => {
      try {
        const contact = await getContactWithValidation(db, params.id, body.workspaceId);

        // Do-not-contact enforcement
        if (contact.status === 'do_not_contact') {
          set.status = 403;
          return {
            success: false,
            error: {
              code: 'COMPLIANCE_001',
              message: 'Contact has opted out of SMS communications. Cannot send message.',
            },
          };
        }

        // Validate phone number exists
        const phoneNumber = body.to || contact.phone || contact.mobile;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_001',
              message: 'Contact has no phone number',
            },
          };
        }

        // Validate message
        if (!body.message || body.message.trim().length === 0) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'SMS_001',
              message: 'Message cannot be empty',
            },
          };
        }

        if (body.message.length > 480) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'SMS_002',
              message: 'Message exceeds maximum length (480 characters)',
            },
          };
        }

        // Resolve template variables in message
        const resolvedMessage = resolveTemplateVars(body.message, contact);

        const twilioSMS = getTwilioSMSAdapter();

        const smsFromNumber = await resolveOutboundNumber({
          recipientPhone: phoneNumber,
          workspaceId: body.workspaceId,
          capability: 'sms',
        });

        const smsResult = await twilioSMS.send({
          to: phoneNumber,
          from: smsFromNumber,
          message: resolvedMessage,
        });

        if (!smsResult.success) {
          await createActivity(db, {
            workspaceId: body.workspaceId,
            contactId: params.id,
            userId: body.userId,
            type: 'sms',
            direction: 'outbound',
            channel: 'sms',
            subject: `Failed SMS to ${phoneNumber}`,
            description: resolvedMessage,
            channelStatus: 'failed',
            channelErrorCode: smsResult.error?.code,
            channelMetadata: {
              phoneNumber,
              provider: 'twilio',
              messageLength: resolvedMessage.length,
            },
          });

          set.status = 500;
          return {
            success: false,
            error: {
              code: smsResult.error?.code || 'SMS_003',
              message: smsResult.error?.message || 'SMS send failed',
            },
          };
        }

        const activity = await createActivity(db, {
          workspaceId: body.workspaceId,
          contactId: params.id,
          userId: body.userId,
          type: 'sms',
          direction: 'outbound',
          channel: 'sms',
          subject: `SMS to ${phoneNumber}`,
          description: resolvedMessage,
          channelMessageId: smsResult.messageId,
          channelStatus: 'sent',
          channelMetadata: {
            phoneNumber,
            provider: 'twilio',
            messageSid: smsResult.messageId,
            messageLength: resolvedMessage.length,
            segments: smsResult.segments,
            cost: smsResult.cost,
          },
        });

        // Create timeline event
        const { timelineService } = await import('../services/timeline');
        await timelineService.create(db, {
          workspaceId: body.workspaceId,
          entityType: 'contact',
          entityId: contact.id,
          eventType: 'activity.sms_sent',
          eventCategory: 'communication',
          eventLabel: 'SMS Sent',
          summary: `Sent SMS: ${resolvedMessage.substring(0, 50)}${resolvedMessage.length > 50 ? '...' : ''}`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: body.userId,
          actorName: await getUserName(body.userId),
          metadata: {
            activityId: activity.id,
            messageId: smsResult.messageId,
            segments: smsResult.segments,
            cost: smsResult.cost,
          },
        });

        return {
          success: true,
          messageId: smsResult.messageId,
          activityId: activity.id,
          segments: smsResult.segments,
          cost: smsResult.cost,
        };
      } catch (error) {
        console.error('[contact-actions/send-sms] Error:', error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'SMS_003',
            message: error instanceof Error ? error.message : 'SMS failed',
          },
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        message: t.String(),
        to: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contact Actions'],
        summary: 'Send SMS to contact',
        description:
          'Send SMS via Twilio to a contact. Max 480 chars (3 segments). Creates activity and timeline event.',
      },
    }
  )

  /**
   * POST /:id/send-whatsapp - Send WhatsApp message to contact
   */
  .post(
    '/:id/send-whatsapp',
    async ({ db, params, body, set }) => {
      try {
        const contact = await getContactWithValidation(db, params.id, body.workspaceId);

        // Do-not-contact enforcement
        if (contact.status === 'do_not_contact') {
          set.status = 403;
          return {
            success: false,
            error: {
              code: 'COMPLIANCE_001',
              message: 'Contact has opted out of communications. Cannot send message.',
            },
          };
        }

        const phoneNumber = body.to || contact.phone || contact.mobile;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_001',
              message: 'Contact has no phone number',
            },
          };
        }

        if (!body.message || body.message.trim().length === 0) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'WA_001',
              message: 'Message cannot be empty',
            },
          };
        }

        if (body.message.length > 4096) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'WA_002',
              message: 'Message exceeds maximum length (4096 characters)',
            },
          };
        }

        const resolvedMessage = resolveTemplateVars(body.message, contact);

        const whatsappAdapter = getTwilioWhatsAppAdapter();

        const waResult = await whatsappAdapter.send({
          to: phoneNumber,
          message: resolvedMessage,
          content: resolvedMessage,
        });

        if (!waResult.success) {
          await createActivity(db, {
            workspaceId: body.workspaceId,
            contactId: params.id,
            userId: body.userId,
            type: 'sms',
            direction: 'outbound',
            channel: 'whatsapp',
            subject: `Failed WhatsApp to ${phoneNumber}`,
            description: resolvedMessage,
            channelStatus: 'failed',
            channelErrorCode: waResult.error?.code,
            channelMetadata: {
              phoneNumber,
              provider: 'twilio',
              messageLength: resolvedMessage.length,
            },
          });

          set.status = 500;
          return {
            success: false,
            error: {
              code: waResult.error?.code || 'WA_003',
              message: waResult.error?.message || 'WhatsApp send failed',
            },
          };
        }

        const activity = await createActivity(db, {
          workspaceId: body.workspaceId,
          contactId: params.id,
          userId: body.userId,
          type: 'sms',
          direction: 'outbound',
          channel: 'whatsapp',
          subject: `WhatsApp to ${phoneNumber}`,
          description: resolvedMessage,
          channelMessageId: waResult.messageId,
          channelStatus: 'sent',
          channelMetadata: {
            phoneNumber,
            provider: 'twilio',
            messageSid: waResult.messageId,
            messageLength: resolvedMessage.length,
          },
        });

        // Create timeline event
        const { timelineService } = await import('../services/timeline');
        await timelineService.create(db, {
          workspaceId: body.workspaceId,
          entityType: 'contact',
          entityId: contact.id,
          eventType: 'activity.whatsapp_sent',
          eventCategory: 'communication',
          eventLabel: 'WhatsApp Sent',
          summary: `Sent WhatsApp: ${resolvedMessage.substring(0, 50)}${resolvedMessage.length > 50 ? '...' : ''}`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: body.userId,
          actorName: await getUserName(body.userId),
          metadata: {
            activityId: activity.id,
            messageId: waResult.messageId,
          },
        });

        return {
          success: true,
          messageId: waResult.messageId,
          activityId: activity.id,
        };
      } catch (error) {
        console.error('[contact-actions/send-whatsapp] Error:', error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'WA_003',
            message: error instanceof Error ? error.message : 'WhatsApp failed',
          },
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        message: t.String(),
        to: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contact Actions'],
        summary: 'Send WhatsApp message to contact',
        description:
          'Send WhatsApp via Twilio to a contact. Max 4096 chars. Creates activity and timeline event.',
      },
    }
  )

  /**
   * POST /:id/email - Send email to contact
   */
  .post(
    '/:id/email',
    async ({ db, params, body, set }) => {
      try {
        const contact = await getContactWithValidation(db, params.id, body.workspaceId);

        // Validate email address
        const emailAddress = body.emailAddress || contact.email;
        if (!emailAddress) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_004',
              message: 'Contact has no email address',
            },
          };
        }

        if (!body.subject || body.subject.trim().length === 0) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'EMAIL_001',
              message: 'Email subject is required',
            },
          };
        }

        if (!body.htmlContent || body.htmlContent.trim().length === 0) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'EMAIL_002',
              message: 'Email content is required',
            },
          };
        }

        // Resolve template variables in email content
        const resolvedSubject = resolveTemplateVars(body.subject, contact);
        const resolvedHtml = resolveTemplateVars(body.htmlContent, contact);
        const resolvedText = body.textContent ? resolveTemplateVars(body.textContent, contact) : undefined;

        const resendAdapter = new ResendAdapter();

        const emailResult = await resendAdapter.send({
          to: emailAddress,
          content: resolvedText || resolvedHtml,
          subject: resolvedSubject,
          workspaceId: body.workspaceId,
          contactId: params.id,
          channelOptions: {
            email: {
              html: resolvedHtml,
              from: process.env.RESEND_FROM_EMAIL || 'campaigns@resend.dev',
            },
          },
        });

        if (!emailResult.success) {
          await createActivity(db, {
            workspaceId: body.workspaceId,
            contactId: params.id,
            userId: body.userId,
            type: 'email',
            direction: 'outbound',
            channel: 'email',
            subject: `Failed: ${resolvedSubject}`,
            description: resolvedHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500),
            channelStatus: 'failed',
            channelErrorCode: emailResult.error?.code,
            channelMetadata: {
              emailAddress,
              provider: 'resend',
              subject: resolvedSubject,
            },
          });

          set.status = 500;
          return {
            success: false,
            error: {
              code: emailResult.error?.code || 'EMAIL_003',
              message: emailResult.error?.message || 'Email send failed',
            },
          };
        }

        const activity = await createActivity(db, {
          workspaceId: body.workspaceId,
          contactId: params.id,
          userId: body.userId,
          type: 'email',
          direction: 'outbound',
          channel: 'email',
          subject: resolvedSubject,
          description: resolvedHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500),
          channelMessageId: emailResult.messageId,
          channelStatus: 'sent',
          channelMetadata: {
            emailAddress,
            provider: 'resend',
            messageId: emailResult.messageId,
            subject: resolvedSubject,
            htmlLength: resolvedHtml.length,
            hasTextVersion: !!resolvedText,
          },
        });

        // Create timeline event
        const { timelineService } = await import('../services/timeline');
        await timelineService.create(db, {
          workspaceId: body.workspaceId,
          entityType: 'contact',
          entityId: contact.id,
          eventType: 'activity.email_sent',
          eventCategory: 'communication',
          eventLabel: 'Email Sent',
          summary: `Sent email: ${resolvedSubject}`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: body.userId,
          actorName: await getUserName(body.userId),
          metadata: {
            activityId: activity.id,
            messageId: emailResult.messageId,
            subject: resolvedSubject,
          },
        });

        return {
          success: true,
          messageId: emailResult.messageId,
          activityId: activity.id,
          status: 'sent',
        };
      } catch (error) {
        console.error('[contact-actions/email] Error:', error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'EMAIL_003',
            message: error instanceof Error ? error.message : 'Email failed',
          },
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        subject: t.String(),
        htmlContent: t.String(),
        textContent: t.Optional(t.String()),
        emailAddress: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contact Actions'],
        summary: 'Send email to contact',
        description:
          'Send email via Resend to a contact. Creates activity, timeline event. Returns message ID and activity ID.',
      },
    }
  );
