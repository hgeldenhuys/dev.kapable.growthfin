/**
 * Lead Action Routes
 * Multi-channel communication endpoints (call, SMS, email) for leads
 * Story: US-SALES-QUEUE-001
 */

import { Elysia, t } from 'elysia';
import { eq, and, isNull } from 'drizzle-orm';
import { crmLeads, crmActivities } from '@agios/db/schema';
import { getTwilioVoiceAdapter, getTwilioSMSAdapter, getTwilioWhatsAppAdapter, ResendAdapter } from '../../../lib/channels';
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
 * Create activity record for a communication action
 */
async function createActivity(
  db: Database,
  params: {
    workspaceId: string;
    leadId: string; // Note: this is the database field name, not the route param
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
      leadId: params.leadId,
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
 * Get lead by ID with validation
 */
async function getLeadWithValidation(
  db: Database,
  id: string,
  workspaceId: string
) {
  const leads = await db
    .select()
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.id, id),
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.deletedAt)
      )
    )
    .limit(1);

  if (leads.length === 0) {
    throw new Error('Lead not found');
  }

  return leads[0];
}

export const leadActionRoutes = new Elysia({ prefix: '/leads' })
  /**
   * POST /:id/call - Initiate outbound call
   */
  .post(
    '/:id/call',
    async ({ db, params, body, set }) => {
      try {
        // Get lead
        const lead = await getLeadWithValidation(db, params.id, body.workspaceId);

        // Validate phone number
        const phoneNumber = body.phoneNumber || lead.phone;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_001',
              message: 'Lead has no phone number',
            },
          };
        }

        // Get Twilio adapter
        const twilioVoice = getTwilioVoiceAdapter();

        // Resolve outbound number with geo-matching
        const fromNumber = await resolveOutboundNumber({
          recipientPhone: phoneNumber,
          workspaceId: body.workspaceId,
          capability: 'voice',
        });

        // Initiate call
        const callResult = await twilioVoice.send({
          to: phoneNumber,
          from: fromNumber,
          // Optional: Use TwiML URL or callback URL if provided
          url: body.callbackUrl,
        });

        if (!callResult.success) {
          // Log failed call attempt
          await createActivity(db, {
            workspaceId: body.workspaceId,
            leadId: params.id,
            userId: body.userId,
            type: 'call',
            direction: 'outbound',
            channel: 'call',
            subject: `Failed call to ${phoneNumber}`,
            description: callResult.error?.message,
            channelStatus: 'failed',
            channelErrorCode: callResult.error?.code,
            channelMetadata: {
              phoneNumber,
              provider: 'twilio',
            },
          });

          set.status = 500;
          return {
            success: false,
            error: {
              code: 'CHAN_003',
              message: callResult.error?.message || 'Call initiation failed',
            },
          };
        }

        // Log successful call initiation
        const activity = await createActivity(db, {
          workspaceId: body.workspaceId,
          leadId: params.id,
          userId: body.userId,
          type: 'call',
          direction: 'outbound',
          channel: 'call',
          subject: `Outbound call to ${phoneNumber}`,
          description: `Call initiated via Twilio`,
          channelMessageId: callResult.messageId, // Call SID
          channelStatus: 'initiated',
          channelMetadata: {
            phoneNumber,
            provider: 'twilio',
            callSid: callResult.messageId,
          },
        });

        // Update last contact date
        await db
          .update(crmLeads)
          .set({
            lastContactDate: new Date(),
            updatedAt: new Date(),
            updatedBy: body.userId,
          })
          .where(eq(crmLeads.id, params.id));

        return {
          success: true,
          callSid: callResult.messageId,
          activityId: activity.id,
          status: 'initiated',
        };
      } catch (error) {
        console.error('[lead-actions/call] Error:', error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'CHAN_003',
            message: error instanceof Error ? error.message : 'Call failed',
          },
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        phoneNumber: t.Optional(t.String()),
        callbackUrl: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lead Actions'],
        summary: 'Initiate call to lead',
        description:
          'Initiate outbound call via Twilio. Logs activity and updates last contact date. Returns call SID and activity ID.',
      },
    }
  )

  /**
   * POST /:id/send-sms - Send SMS to lead
   */
  .post(
    '/:id/send-sms',
    async ({ db, params, body, set }) => {
      try {
        // Get lead with workspace validation
        const lead = await getLeadWithValidation(db, params.id, body.workspaceId);

        // US-SMS-015, US-SMS-016: Do-not-contact enforcement (TCPA compliance)
        if (lead.status === 'do_not_contact') {
          set.status = 403;
          return {
            success: false,
            error: {
              code: 'COMPLIANCE_001',
              message: 'Lead has opted out of SMS communications. Cannot send message.',
            },
          };
        }

        // Validate phone number exists
        const phoneNumber = body.to || lead.phone;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_001',
              message: 'Lead has no phone number',
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

        // Check message length (480 chars max as per spec)
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
        const resolvedMessage = resolveTemplateVars(body.message, lead);

        // Get Twilio SMS adapter
        const twilioSMS = getTwilioSMSAdapter();

        // Resolve outbound number with geo-matching
        const smsFromNumber = await resolveOutboundNumber({
          recipientPhone: phoneNumber,
          workspaceId: body.workspaceId,
          capability: 'sms',
        });

        // Send SMS
        const smsResult = await twilioSMS.send({
          to: phoneNumber,
          from: smsFromNumber,
          message: resolvedMessage,
        });

        if (!smsResult.success) {
          // Log failed SMS attempt
          await createActivity(db, {
            workspaceId: body.workspaceId,
            leadId: params.id,
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

        // Log successful SMS with activity and timeline
        const activity = await createActivity(db, {
          workspaceId: body.workspaceId,
          leadId: params.id,
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
          entityType: 'lead',
          entityId: lead.id,
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

        // Update last contact date and status
        await db
          .update(crmLeads)
          .set({
            lastContactDate: new Date(),
            status: 'contacted',
            updatedAt: new Date(),
            updatedBy: body.userId,
          })
          .where(eq(crmLeads.id, params.id));

        return {
          success: true,
          messageId: smsResult.messageId,
          activityId: activity.id,
          segments: smsResult.segments,
          cost: smsResult.cost,
        };
      } catch (error) {
        console.error('[lead-actions/send-sms] Error:', error);
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
        templateId: t.Optional(t.String()),
        variables: t.Optional(t.Record(t.String(), t.String())),
      }),
      detail: {
        tags: ['Lead Actions'],
        summary: 'Send SMS to lead',
        description:
          'Send SMS via Twilio. Max 480 chars (3 segments). Creates activity and timeline event. Returns message ID, segment count, and cost.',
      },
    }
  )

  /**
   * POST /:id/send-whatsapp - Send WhatsApp message to lead
   */
  .post(
    '/:id/send-whatsapp',
    async ({ db, params, body, set }) => {
      try {
        const lead = await getLeadWithValidation(db, params.id, body.workspaceId);

        // TCPA compliance: do-not-contact enforcement
        if (lead.status === 'do_not_contact') {
          set.status = 403;
          return {
            success: false,
            error: {
              code: 'COMPLIANCE_001',
              message: 'Lead has opted out of communications. Cannot send message.',
            },
          };
        }

        const phoneNumber = body.to || lead.phone;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_001',
              message: 'Lead has no phone number',
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

        const resolvedMessage = resolveTemplateVars(body.message, lead);

        const whatsappAdapter = getTwilioWhatsAppAdapter();

        const waResult = await whatsappAdapter.send({
          to: phoneNumber,
          message: resolvedMessage,
          content: resolvedMessage,
        });

        if (!waResult.success) {
          await createActivity(db, {
            workspaceId: body.workspaceId,
            leadId: params.id,
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
          leadId: params.id,
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
          entityType: 'lead',
          entityId: lead.id,
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

        // Update last contact date and status
        await db
          .update(crmLeads)
          .set({
            lastContactDate: new Date(),
            status: 'contacted',
            updatedAt: new Date(),
            updatedBy: body.userId,
          })
          .where(eq(crmLeads.id, params.id));

        return {
          success: true,
          messageId: waResult.messageId,
          activityId: activity.id,
        };
      } catch (error) {
        console.error('[lead-actions/send-whatsapp] Error:', error);
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
        tags: ['Lead Actions'],
        summary: 'Send WhatsApp message to lead',
        description:
          'Send WhatsApp via Twilio. Max 4096 chars. Creates activity and timeline event. Returns message ID and activity ID.',
      },
    }
  )

  /**
   * POST /:id/email - Send email to lead
   */
  .post(
    '/:id/email',
    async ({ db, params, body, set }) => {
      try {
        // Get lead
        const lead = await getLeadWithValidation(db, params.id, body.workspaceId);

        // Validate email address
        const emailAddress = body.emailAddress || lead.email;
        if (!emailAddress) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'CHAN_004',
              message: 'Lead has no email address',
            },
          };
        }

        // Validate subject and content
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
        const resolvedSubject = resolveTemplateVars(body.subject, lead);
        const resolvedHtml = resolveTemplateVars(body.htmlContent, lead);
        const resolvedText = body.textContent ? resolveTemplateVars(body.textContent, lead) : undefined;

        // Get Resend adapter
        const resendAdapter = new ResendAdapter();

        // Send email
        const emailResult = await resendAdapter.send({
          to: emailAddress,
          content: resolvedText || resolvedHtml,
          subject: resolvedSubject,
          workspaceId: body.workspaceId,
          leadId: params.id, // Add lead ID for ownership tracking
          channelOptions: {
            email: {
              html: resolvedHtml,
              from: process.env.RESEND_FROM_EMAIL || 'campaigns@resend.dev',
            },
          },
        });

        if (!emailResult.success) {
          // Log failed email attempt
          await createActivity(db, {
            workspaceId: body.workspaceId,
            leadId: params.id,
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

        // Log successful email
        const activity = await createActivity(db, {
          workspaceId: body.workspaceId,
          leadId: params.id,
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

        // Update last contact date
        await db
          .update(crmLeads)
          .set({
            lastContactDate: new Date(),
            updatedAt: new Date(),
            updatedBy: body.userId,
          })
          .where(eq(crmLeads.id, params.id));

        return {
          success: true,
          messageId: emailResult.messageId,
          activityId: activity.id,
          status: 'sent',
        };
      } catch (error) {
        console.error('[lead-actions/email] Error:', error);
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
        scheduleAt: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lead Actions'],
        summary: 'Send email to lead',
        description:
          'Send email via Resend. Logs activity and updates last contact date. Returns message ID and activity ID.',
      },
    }
  );
