/**
 * Twilio Webhook Routes
 * Handle incoming webhooks from Twilio for SMS tracking and inbound messages
 *
 * Multi-workspace support:
 * - Inbound SMS: Routes by destination phone number to correct workspace
 * - Status callbacks: Already have workspaceId in URL params from outbound send
 */

import { Elysia, t } from 'elysia';
import { db, workspaces, type WorkspaceSettings } from '@agios/db';
import { crmActivities, crmLeads, crmCampaignRecipients, crmContacts, type CrmContact } from '@agios/db';
import { eq, or, sql } from 'drizzle-orm';
import { timelineService } from '../services/timeline';
import { getTwilioSMSAdapter } from '../../../lib/channels';

/**
 * Find workspace by phone number
 *
 * Looks up which workspace owns a given phone number by checking
 * the workspace.settings.twilio.phoneNumbers array or defaultPhoneNumber
 *
 * @example
 * const workspace = await findWorkspaceByPhoneNumber('+27821234567');
 * if (workspace) {
 *   console.log('Phone belongs to workspace:', workspace.id);
 * }
 */
export async function findWorkspaceByPhoneNumber(phoneNumber: string): Promise<{ id: string; settings: WorkspaceSettings } | null> {
  // Normalize phone number (remove any non-digit characters except +)
  const normalized = phoneNumber.replace(/[^\d+]/g, '');

  try {
    // Query workspaces where settings.twilio.defaultPhoneNumber matches
    // OR settings.twilio.phoneNumbers contains the number
    const result = await db
      .select({
        id: workspaces.id,
        settings: workspaces.settings,
      })
      .from(workspaces)
      .where(
        sql`(
          ${workspaces.settings}->>'twilio' IS NOT NULL
          AND (
            ${workspaces.settings}->'twilio'->>'defaultPhoneNumber' = ${normalized}
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(${workspaces.settings}->'twilio'->'phoneNumbers') AS pn
              WHERE pn->>'number' = ${normalized}
            )
          )
        )`
      )
      .limit(1);

    if (result[0]) {
      return {
        id: result[0].id,
        settings: result[0].settings as WorkspaceSettings,
      };
    }

    return null;
  } catch (error) {
    console.error('[Twilio Webhook] Error finding workspace by phone number:', error);
    return null;
  }
}

/**
 * US-SMS-014: TCPA Compliance - Opt-out keyword detection
 * Required by law in the United States (Telephone Consumer Protection Act)
 */
function isOptOutKeyword(message: string): boolean {
  const normalized = message.trim().toUpperCase();
  const optOutKeywords = [
    'STOP',
    'STOPALL',
    'UNSUBSCRIBE',
    'CANCEL',
    'END',
    'QUIT'
  ];
  return optOutKeywords.includes(normalized);
}

/**
 * US-SMS-015: Opt-in keyword detection (START, UNSTOP)
 */
function isOptInKeyword(message: string): boolean {
  const normalized = message.trim().toUpperCase();
  return normalized === 'START' || normalized === 'UNSTOP';
}

export const twilioWebhookRoutes = new Elysia({ prefix: '/webhooks/twilio' })

  /**
   * POST /sms/inbound - Handle inbound SMS messages from leads
   */
  .post('/sms/inbound', async ({ body, request, set }) => {
    const payload = body as {
      MessageSid: string;
      From: string;
      To: string;
      Body: string;
      NumSegments?: string;
      AccountSid?: string;
      MessagingServiceSid?: string;
    };

    console.log('[Twilio SMS Webhook] Received inbound SMS:', {
      messageSid: payload.MessageSid,
      from: payload.From,
      to: payload.To,
      bodyLength: payload.Body?.length || 0,
    });

    try {
      // Validate webhook signature
      const twilioAdapter = getTwilioSMSAdapter();
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const isValid = twilioAdapter['validateWebhookSignature'](payload, headers);
      if (!isValid) {
        console.error('[Twilio SMS Webhook] Invalid signature');
        set.status = 403;
        return { error: 'Invalid signature' };
      }

      // Look up lead by phone number
      const fromNumber = payload.From;
      const leads = await db
        .select()
        .from(crmLeads)
        .where(eq(crmLeads.phone, fromNumber))
        .limit(1);

      const lead = leads[0];

      if (!lead) {
        // Phase G.3: Try to find contact by any of their phone fields
        const contacts = await db
          .select()
          .from(crmContacts)
          .where(
            or(
              eq(crmContacts.phone, fromNumber),
              eq(crmContacts.phoneSecondary, fromNumber),
              eq(crmContacts.mobile, fromNumber)
            )
          )
          .limit(1);

        const contact = contacts[0];

        if (!contact) {
          console.warn(`[Twilio SMS Webhook] No lead or contact found for phone: ${fromNumber}`);
          // Return success but log warning - don't fail webhook
          set.headers['Content-Type'] = 'text/xml';
          return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
        }

        // Handle contact-based inbound SMS (Phase G.3)
        return await handleContactInboundSMS(contact, payload, set);
      }

      // US-SMS-015: Check for opt-in keyword (START, UNSTOP)
      if (isOptInKeyword(payload.Body) && lead.status === 'do_not_contact') {
        console.log(`[Twilio SMS Webhook] Lead ${lead.id} opted back in via ${payload.Body}`);

        // Update lead status to contacted
        await db.update(crmLeads).set({
          status: 'contacted',
          updatedAt: new Date(),
        }).where(eq(crmLeads.id, lead.id));

        // Send confirmation message (use workspace phone number)
        const twilioAdapter = getTwilioSMSAdapter();
        await twilioAdapter.send({
          to: fromNumber,
          message: 'You have been resubscribed and will receive messages from us. Reply STOP to unsubscribe.',
          workspaceId: lead.workspaceId, // Use workspace's configured phone number
        });

        // Create opt-in activity
        await db.insert(crmActivities).values({
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          assigneeId: lead.ownerId!,
          type: 'sms',
          direction: 'inbound',
          channel: 'sms',
          subject: 'SMS Opt-In',
          description: payload.Body,
          status: 'completed',
          channelMessageId: payload.MessageSid,
          channelStatus: 'opted_in',
          channelMetadata: {
            provider: 'twilio',
            optIn: true,
            keyword: payload.Body.trim().toUpperCase(),
          },
        });

        // US-SMS-016: Create compliance timeline event for opt-in
        await timelineService.create(db, {
          workspaceId: lead.workspaceId,
          entityType: 'lead',
          entityId: lead.id,
          eventType: 'compliance.sms_opt_in',
          eventCategory: 'compliance',
          eventLabel: 'SMS Opt-In',
          summary: 'Lead opted back in to SMS communications',
          occurredAt: new Date(),
          actorType: 'integration', // Use 'integration' since lead initiated via SMS
          actorId: null,
          actorName: lead.firstName + ' ' + lead.lastName,
          metadata: {
            keyword: payload.Body.trim().toUpperCase(),
            messageId: payload.MessageSid,
            leadId: lead.id, // Store lead ID in metadata
          },
        });

        // Return TwiML - no default message
        set.headers['Content-Type'] = 'text/xml';
        return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
      }

      // US-SMS-014, US-SMS-015: Check for opt-out keyword (STOP, STOPALL, etc.)
      if (isOptOutKeyword(payload.Body)) {
        console.log(`[Twilio SMS Webhook] Lead ${lead.id} opted out via ${payload.Body}`);

        // Update lead status to do_not_contact
        await db.update(crmLeads).set({
          status: 'do_not_contact',
          updatedAt: new Date(),
        }).where(eq(crmLeads.id, lead.id));

        // Send auto-reply (required by TCPA) - use workspace phone number
        const twilioAdapter = getTwilioSMSAdapter();
        await twilioAdapter.send({
          to: fromNumber,
          message: 'You have been unsubscribed and will not receive further messages from us. Reply START to resubscribe.',
          workspaceId: lead.workspaceId, // Use workspace's configured phone number
        });

        // Create opt-out activity
        await db.insert(crmActivities).values({
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          assigneeId: lead.ownerId!,
          type: 'sms',
          direction: 'inbound',
          channel: 'sms',
          subject: 'SMS Opt-Out',
          description: payload.Body,
          status: 'completed',
          channelMessageId: payload.MessageSid,
          channelStatus: 'opted_out',
          channelMetadata: {
            provider: 'twilio',
            optOut: true,
            keyword: payload.Body.trim().toUpperCase(),
          },
        });

        // US-SMS-016: Create compliance timeline event for opt-out
        await timelineService.create(db, {
          workspaceId: lead.workspaceId,
          entityType: 'lead',
          entityId: lead.id,
          eventType: 'compliance.sms_opt_out',
          eventCategory: 'compliance',
          eventLabel: 'SMS Opt-Out',
          summary: `Lead opted out of SMS communications via ${payload.Body.trim().toUpperCase()}`,
          occurredAt: new Date(),
          actorType: 'integration', // Use 'integration' since lead initiated via SMS
          actorId: null,
          actorName: lead.firstName + ' ' + lead.lastName,
          metadata: {
            keyword: payload.Body.trim().toUpperCase(),
            messageId: payload.MessageSid,
            autoReplyInvoked: true,
            leadId: lead.id, // Store lead ID in metadata
          },
        });

        // Return TwiML - no default message (auto-reply already sent)
        set.headers['Content-Type'] = 'text/xml';
        return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
      }

      // Create activity for inbound SMS (normal message, not opt-out/opt-in)
      const activity = await db
        .insert(crmActivities)
        .values({
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          assigneeId: lead.ownerId!, // Assign to lead owner
          type: 'sms',
          direction: 'inbound',
          channel: 'sms',
          subject: `SMS from ${fromNumber}`,
          description: payload.Body,
          status: 'completed',
          channelMessageId: payload.MessageSid,
          channelStatus: 'received',
          channelMetadata: {
            provider: 'twilio',
            from: fromNumber,
            to: payload.To,
            segments: parseInt(payload.NumSegments || '1', 10),
            receivedAt: new Date().toISOString(),
          },
        })
        .returning();

      console.log(`[Twilio SMS Webhook] Created inbound activity ${activity[0].id} for lead ${lead.id}`);

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: lead.workspaceId,
        entityType: 'lead',
        entityId: lead.id,
        eventType: 'activity.sms_received',
        eventCategory: 'communication',
        eventLabel: 'SMS Received',
        summary: `Received SMS: ${payload.Body.substring(0, 50)}${payload.Body.length > 50 ? '...' : ''}`,
        occurredAt: new Date(),
        actorType: 'integration',
        actorId: null,
        actorName: fromNumber,
        metadata: {
          activityId: activity[0].id,
          messageId: payload.MessageSid,
          from: fromNumber,
          segments: parseInt(payload.NumSegments || '1', 10),
        },
      });

      // Update lead's last contact date and status to contacted
      await db
        .update(crmLeads)
        .set({
          lastContactDate: new Date(),
          status: 'contacted', // Auto-mark as contacted when inbound SMS received
          updatedAt: new Date(),
        })
        .where(eq(crmLeads.id, lead.id));

      console.log(`[Twilio SMS Webhook] Updated lead ${lead.id} status to contacted`);

      // Return TwiML response
      set.headers['Content-Type'] = 'text/xml';
      return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    } catch (error) {
      console.error('[Twilio SMS Webhook] Error processing inbound SMS:', error);
      set.status = 500;
      return { error: 'Internal server error' };
    }
  }, {
    body: t.Object({
      MessageSid: t.String(),
      From: t.String(),
      To: t.String(),
      Body: t.String(),
      NumSegments: t.Optional(t.String()),
      AccountSid: t.Optional(t.String()),
      MessagingServiceSid: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Webhooks', 'SMS'],
      summary: 'Handle inbound SMS from Twilio',
      description: 'Process incoming SMS messages from leads. Creates activity, timeline event, and updates lead status.',
    },
  })

  /**
   * POST /sms/status - Handle SMS delivery status callbacks
   *
   * Phase G.2: Now supports campaign context via query params:
   * - CampaignId: Campaign ID for recipient status updates
   * - RecipientId: Campaign recipient ID to update
   */
  .post('/sms/status', async ({ body, request, set, query }) => {
    const payload = body as {
      MessageSid: string;
      MessageStatus: string;
      From?: string;
      To?: string;
      ErrorCode?: string;
      ErrorMessage?: string;
      Price?: string;
      PriceUnit?: string;
    };

    // Extract campaign context from query params (Phase G.2)
    const campaignId = query?.CampaignId as string | undefined;
    const recipientId = query?.RecipientId as string | undefined;

    console.log('[Twilio SMS Webhook] Received status callback:', {
      messageSid: payload.MessageSid,
      status: payload.MessageStatus,
      errorCode: payload.ErrorCode,
      campaignId,
      recipientId,
    });

    try {
      // Validate webhook signature
      const twilioAdapter = getTwilioSMSAdapter();
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const isValid = twilioAdapter['validateWebhookSignature'](payload, headers);
      if (!isValid) {
        console.error('[Twilio SMS Webhook] Invalid signature');
        set.status = 403;
        return { error: 'Invalid signature' };
      }

      // Find activity by channel message ID
      const activities = await db
        .select()
        .from(crmActivities)
        .where(eq(crmActivities.channelMessageId, payload.MessageSid))
        .limit(1);

      const activity = activities[0];

      if (!activity) {
        console.warn(`[Twilio SMS Webhook] No activity found for MessageSid: ${payload.MessageSid}`);
        // Return success but log warning - don't fail webhook
        return { received: true, warning: 'Activity not found' };
      }

      // Calculate cost if available (Twilio price is negative, e.g., "-0.00750")
      let cost: number | undefined;
      if (payload.Price) {
        cost = Math.abs(parseFloat(payload.Price) * 100); // Convert to cents
      }

      // Update activity with new status
      const currentMetadata = activity.channelMetadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        status: payload.MessageStatus,
        errorCode: payload.ErrorCode,
        errorMessage: payload.ErrorMessage,
        cost,
        priceUnit: payload.PriceUnit,
        lastStatusUpdate: new Date().toISOString(),
      };

      await db
        .update(crmActivities)
        .set({
          channelStatus: payload.MessageStatus,
          channelErrorCode: payload.ErrorCode,
          channelMetadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(crmActivities.id, activity.id));

      console.log(`[Twilio SMS Webhook] Updated activity ${activity.id} status to ${payload.MessageStatus}`);

      // Phase G.2: Update campaign recipient status if campaign context provided
      if (campaignId && recipientId) {
        const statusMap: Record<string, { status: string; field: 'sentAt' | 'deliveredAt' | null }> = {
          'sent': { status: 'sent', field: 'sentAt' },
          'delivered': { status: 'delivered', field: 'deliveredAt' },
          'failed': { status: 'failed', field: null },
          'undelivered': { status: 'failed', field: null },
        };

        const mapping = statusMap[payload.MessageStatus.toLowerCase()];
        if (mapping) {
          const updateData: Record<string, any> = {
            status: mapping.status,
            updatedAt: new Date(),
          };

          // Set timestamp field if applicable
          if (mapping.field) {
            updateData[mapping.field] = new Date();
          }

          await db.update(crmCampaignRecipients)
            .set(updateData)
            .where(eq(crmCampaignRecipients.id, recipientId));

          console.log(`[Twilio SMS Webhook] Updated campaign recipient ${recipientId} status to ${mapping.status}`);
        }
      }

      // Create timeline event for significant status changes
      const significantStatuses = ['delivered', 'failed', 'undelivered'];
      if (significantStatuses.includes(payload.MessageStatus.toLowerCase())) {
        const entityType = activity.leadId ? 'lead' : 'contact';
        const entityId = activity.leadId || activity.contactId;

        if (entityType && entityId) {
          await timelineService.create(db, {
            workspaceId: activity.workspaceId,
            entityType: entityType as any,
            entityId,
            eventType: `activity.sms_${payload.MessageStatus.toLowerCase()}`,
            eventCategory: 'communication',
            eventLabel: `SMS ${payload.MessageStatus}`,
            summary: getSummaryForStatus(payload.MessageStatus, payload.ErrorMessage),
            occurredAt: new Date(),
            actorType: 'system',
            actorId: null,
            actorName: 'Twilio',
            metadata: {
              activityId: activity.id,
              messageId: payload.MessageSid,
              status: payload.MessageStatus,
              errorCode: payload.ErrorCode,
              cost,
            },
          });
        }
      }

      return { received: true, activityId: activity.id };
    } catch (error) {
      console.error('[Twilio SMS Webhook] Error processing status callback:', error);
      set.status = 500;
      return { error: 'Internal server error' };
    }
  }, {
    body: t.Object({
      MessageSid: t.String(),
      MessageStatus: t.String(),
      From: t.Optional(t.String()),
      To: t.Optional(t.String()),
      ErrorCode: t.Optional(t.String()),
      ErrorMessage: t.Optional(t.String()),
      Price: t.Optional(t.String()),
      PriceUnit: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Webhooks', 'SMS'],
      summary: 'Handle SMS status callbacks from Twilio',
      description: 'Process SMS delivery status updates (queued, sent, delivered, failed, undelivered).',
    },
  });

/**
 * Get human-readable summary for SMS status
 */
function getSummaryForStatus(status: string, errorMessage?: string): string {
  const statusLower = status.toLowerCase();

  switch (statusLower) {
    case 'delivered':
      return 'SMS delivered successfully';
    case 'failed':
      return `SMS failed: ${errorMessage || 'Unknown error'}`;
    case 'undelivered':
      return `SMS undelivered: ${errorMessage || 'Carrier rejected'}`;
    case 'sent':
      return 'SMS sent to carrier';
    case 'queued':
      return 'SMS queued for delivery';
    default:
      return `SMS status: ${status}`;
  }
}

/**
 * Phase G.3: Handle inbound SMS from a contact (not a lead)
 *
 * Supports:
 * - Opt-out (STOP) handling
 * - Opt-in (START) handling
 * - Normal message activity creation
 */
async function handleContactInboundSMS(
  contact: CrmContact,
  payload: {
    MessageSid: string;
    From: string;
    To: string;
    Body: string;
    NumSegments?: string;
  },
  set: any
): Promise<string> {
  const fromNumber = payload.From;

  // Handle opt-out (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)
  if (isOptOutKeyword(payload.Body)) {
    console.log(`[Twilio SMS Webhook] Contact ${contact.id} opted out via ${payload.Body}`);

    // Update contact status to do_not_contact
    await db.update(crmContacts).set({
      status: 'do_not_contact',
      updatedAt: new Date(),
    }).where(eq(crmContacts.id, contact.id));

    // Send confirmation message
    const twilioAdapter = getTwilioSMSAdapter();
    await twilioAdapter.send({
      to: fromNumber,
      message: 'You have been unsubscribed and will not receive further messages from us. Reply START to resubscribe.',
      workspaceId: contact.workspaceId,
    });

    // Create opt-out activity with contactId
    await db.insert(crmActivities).values({
      workspaceId: contact.workspaceId,
      contactId: contact.id,
      leadId: null,
      assigneeId: contact.ownerId!,
      type: 'sms',
      direction: 'inbound',
      channel: 'sms',
      subject: 'SMS Opt-Out',
      description: payload.Body,
      status: 'completed',
      channelMessageId: payload.MessageSid,
      channelStatus: 'opted_out',
      channelMetadata: {
        provider: 'twilio',
        optOut: true,
        keyword: payload.Body.trim().toUpperCase(),
      },
    });

    // Create compliance timeline event for contact
    await timelineService.create(db, {
      workspaceId: contact.workspaceId,
      entityType: 'contact',
      entityId: contact.id,
      eventType: 'compliance.sms_opt_out',
      eventCategory: 'compliance',
      eventLabel: 'SMS Opt-Out',
      summary: `Contact opted out of SMS communications via ${payload.Body.trim().toUpperCase()}`,
      occurredAt: new Date(),
      actorType: 'integration',
      actorId: null,
      actorName: contact.firstName + ' ' + contact.lastName,
      metadata: {
        keyword: payload.Body.trim().toUpperCase(),
        messageId: payload.MessageSid,
        contactId: contact.id,
      },
    });

    set.headers['Content-Type'] = 'text/xml';
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  // Handle opt-in (START, UNSTOP)
  if (isOptInKeyword(payload.Body) && contact.status === 'do_not_contact') {
    console.log(`[Twilio SMS Webhook] Contact ${contact.id} opted back in via ${payload.Body}`);

    // Update contact status to active
    await db.update(crmContacts).set({
      status: 'active',
      updatedAt: new Date(),
    }).where(eq(crmContacts.id, contact.id));

    // Send confirmation message
    const twilioAdapter = getTwilioSMSAdapter();
    await twilioAdapter.send({
      to: fromNumber,
      message: 'You have been resubscribed and will receive messages from us. Reply STOP to unsubscribe.',
      workspaceId: contact.workspaceId,
    });

    // Create opt-in activity with contactId
    await db.insert(crmActivities).values({
      workspaceId: contact.workspaceId,
      contactId: contact.id,
      leadId: null,
      assigneeId: contact.ownerId!,
      type: 'sms',
      direction: 'inbound',
      channel: 'sms',
      subject: 'SMS Opt-In',
      description: payload.Body,
      status: 'completed',
      channelMessageId: payload.MessageSid,
      channelStatus: 'opted_in',
      channelMetadata: {
        provider: 'twilio',
        optIn: true,
        keyword: payload.Body.trim().toUpperCase(),
      },
    });

    // Create compliance timeline event for contact
    await timelineService.create(db, {
      workspaceId: contact.workspaceId,
      entityType: 'contact',
      entityId: contact.id,
      eventType: 'compliance.sms_opt_in',
      eventCategory: 'compliance',
      eventLabel: 'SMS Opt-In',
      summary: 'Contact opted back in to SMS communications',
      occurredAt: new Date(),
      actorType: 'integration',
      actorId: null,
      actorName: contact.firstName + ' ' + contact.lastName,
      metadata: {
        keyword: payload.Body.trim().toUpperCase(),
        messageId: payload.MessageSid,
        contactId: contact.id,
      },
    });

    set.headers['Content-Type'] = 'text/xml';
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  // Normal inbound SMS from contact
  const activity = await db
    .insert(crmActivities)
    .values({
      workspaceId: contact.workspaceId,
      contactId: contact.id,
      leadId: null,
      assigneeId: contact.ownerId!,
      type: 'sms',
      direction: 'inbound',
      channel: 'sms',
      subject: `SMS from ${fromNumber}`,
      description: payload.Body,
      status: 'completed',
      channelMessageId: payload.MessageSid,
      channelStatus: 'received',
      channelMetadata: {
        provider: 'twilio',
        from: fromNumber,
        to: payload.To,
        segments: parseInt(payload.NumSegments || '1', 10),
        receivedAt: new Date().toISOString(),
      },
    })
    .returning();

  console.log(`[Twilio SMS Webhook] Created inbound activity ${activity[0].id} for contact ${contact.id}`);

  // Create timeline event for contact
  await timelineService.create(db, {
    workspaceId: contact.workspaceId,
    entityType: 'contact',
    entityId: contact.id,
    eventType: 'activity.sms_received',
    eventCategory: 'communication',
    eventLabel: 'SMS Received',
    summary: `Received SMS: ${payload.Body.substring(0, 50)}${payload.Body.length > 50 ? '...' : ''}`,
    occurredAt: new Date(),
    actorType: 'integration',
    actorId: null,
    actorName: fromNumber,
    metadata: {
      activityId: activity[0].id,
      messageId: payload.MessageSid,
      from: fromNumber,
      segments: parseInt(payload.NumSegments || '1', 10),
    },
  });

  set.headers['Content-Type'] = 'text/xml';
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}
