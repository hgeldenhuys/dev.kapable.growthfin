/**
 * Campaign Execution Worker
 * Processes campaign execution jobs and sends messages across multiple channels
 */

import { jobQueue, type JobName } from '../lib/queue';
import { db } from '@agios/db';
import { crmCampaigns, crmCampaignRecipients, crmCampaignMessages, crmAiVoiceQueue, AI_VOICE_DEFAULTS, type AiCallConfig } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { getResendProvider } from '../lib/providers/resend';
import { getTwilioSMSAdapter } from '../lib/channels/adapters/twilio-sms-adapter';
import { getTwilioVoiceAdapter } from '../lib/channels/adapters/twilio-voice-adapter';
import { getTwilioWhatsAppAdapter } from '../lib/channels/adapters/twilio-whatsapp-adapter';
import { timelineService } from '../modules/crm/services/timeline';
import { abTestingService } from '../modules/crm/services/ab-testing';
import { dripService } from '../modules/crm/services/drip';
import { SmsRateLimitService } from '../modules/crm/services/sms-rate-limit.service';
import { EmailRateLimitService } from '../modules/crm/services/email-rate-limit.service';
import { EmailSuppressionService } from '../modules/crm/services/email-suppression.service';
import type { OutboundMessage, SendResult } from '../lib/channels/types';
import { sandboxService } from '../lib/channels/sandbox-service';
import { SandboxEmailAdapter } from '../lib/channels/adapters/sandbox-email-adapter';
import { SandboxSmsAdapter } from '../lib/channels/adapters/sandbox-sms-adapter';
import { SandboxVoiceAdapter } from '../lib/channels/adapters/sandbox-voice-adapter';
import { SandboxAiVoiceAdapter } from '../lib/channels/adapters/sandbox-ai-voice-adapter';

const resendProvider = getResendProvider();

// Sandbox adapter singletons (lazily initialized)
let sandboxEmailAdapter: SandboxEmailAdapter | null = null;
let sandboxSmsAdapter: SandboxSmsAdapter | null = null;
let twilioSMSAdapter: ReturnType<typeof getTwilioSMSAdapter> | null = null;
let twilioVoiceAdapter: ReturnType<typeof getTwilioVoiceAdapter> | null = null;
let twilioWhatsAppAdapter: ReturnType<typeof getTwilioWhatsAppAdapter> | null = null;

/**
 * Get Twilio SMS adapter (lazy initialization with error handling)
 */
function getTwilioSMS() {
  if (!twilioSMSAdapter) {
    try {
      twilioSMSAdapter = getTwilioSMSAdapter();
    } catch (error) {
      console.warn('[Campaign Worker] Twilio SMS adapter not available:', error);
      return null;
    }
  }
  return twilioSMSAdapter;
}

/**
 * Get Twilio Voice adapter (lazy initialization with error handling)
 */
function getTwilioVoice() {
  if (!twilioVoiceAdapter) {
    try {
      twilioVoiceAdapter = getTwilioVoiceAdapter();
    } catch (error) {
      console.warn('[Campaign Worker] Twilio Voice adapter not available:', error);
      return null;
    }
  }
  return twilioVoiceAdapter;
}

/**
 * Get Twilio WhatsApp adapter (lazy initialization with error handling)
 */
function getTwilioWhatsApp() {
  if (!twilioWhatsAppAdapter) {
    try {
      twilioWhatsAppAdapter = getTwilioWhatsAppAdapter();
    } catch (error) {
      console.warn('[Campaign Worker] Twilio WhatsApp adapter not available:', error);
      return null;
    }
  }
  return twilioWhatsAppAdapter;
}

export interface ExecuteCampaignJob {
  campaignId: string;
  messageId?: string; // Optional - for single message campaigns or specific message
  workspaceId: string;
  isAbTest?: boolean; // Flag to indicate A/B test campaign
}

/**
 * Execute a campaign by sending emails to all pending recipients
 */
async function executeCampaign(job: ExecuteCampaignJob): Promise<void> {
  const { campaignId, messageId, workspaceId, isAbTest } = job;

  console.log(`[Campaign Worker] Starting campaign execution: ${campaignId}, A/B Test: ${isAbTest || false}`);

  // Get campaign
  const campaigns = await db
    .select()
    .from(crmCampaigns)
    .where(and(eq(crmCampaigns.id, campaignId), eq(crmCampaigns.workspaceId, workspaceId)));

  const campaign = campaigns[0];
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  // Get all messages for this campaign
  const allMessages = await db
    .select()
    .from(crmCampaignMessages)
    .where(
      and(
        eq(crmCampaignMessages.campaignId, campaignId),
        eq(crmCampaignMessages.workspaceId, workspaceId),
        isNull(crmCampaignMessages.deletedAt)
      )
    );

  if (allMessages.length === 0) {
    throw new Error('No messages found for campaign');
  }

  // Check if this is a drip campaign (messages have sequence_order)
  const isDripCampaign = allMessages.some((m) => m.sequenceOrder !== null) || campaign.type === 'drip';

  // Check if this is an A/B test (multiple messages or type is 'ab_test')
  const isAbTestCampaign = isAbTest || (allMessages.length > 1 && !isDripCampaign) || campaign.type === 'ab_test';

  // Distribute recipients to variants if A/B test
  let recipientDistribution = new Map<string, { messageId: string; variantName: string }>();
  if (isAbTestCampaign) {
    console.log('[Campaign Worker] A/B test detected, distributing recipients across variants...');
    recipientDistribution = await abTestingService.distributeRecipients(db, campaignId, workspaceId);

    // Update recipients with their assigned variants
    for (const [recipientId, assignment] of recipientDistribution.entries()) {
      await db
        .update(crmCampaignRecipients)
        .set({
          messageId: assignment.messageId,
          variantName: assignment.variantName,
        })
        .where(eq(crmCampaignRecipients.id, recipientId));
    }

    console.log(`[Campaign Worker] Distributed ${recipientDistribution.size} recipients across ${allMessages.length} variants`);

    // Create A/B test started timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: campaignId,
      eventType: 'campaign.ab_test_started',
      eventCategory: 'system',
      eventLabel: 'A/B Test Started',
      summary: `A/B test started for campaign "${campaign.name}" with ${allMessages.length} variants`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'Campaign Worker',
      metadata: {
        campaignId,
        campaignName: campaign.name,
        variantCount: allMessages.length,
        variants: allMessages.map((m) => ({
          variantName: m.variantName,
          messageId: m.id,
          testPercentage: m.testPercentage,
        })),
      },
    });
  }

  // Get pending recipients with contact data
  let recipients = await db.query.crmCampaignRecipients.findMany({
    where: and(
      eq(crmCampaignRecipients.campaignId, campaignId),
      eq(crmCampaignRecipients.status, 'pending')
    ),
    with: {
      contact: true,
    },
  });

  console.log(`[Campaign Worker] Found ${recipients.length} pending recipients`);

  if (recipients.length === 0) {
    console.log('[Campaign Worker] No pending recipients, marking campaign as completed');
    await db
      .update(crmCampaigns)
      .set({ status: 'completed', endedAt: new Date() })
      .where(eq(crmCampaigns.id, campaignId));
    return;
  }

  // Phase P: Filter out suppressed email addresses before sending
  const hasEmailChannel = allMessages.some((m) => m.channel === 'email');
  if (hasEmailChannel) {
    const emailRecipients = recipients.filter((r) => r.contact?.email);
    if (emailRecipients.length > 0) {
      const emails = emailRecipients.map((r) => r.contact.email);
      const { suppressed } = await EmailSuppressionService.filterSuppressed(workspaceId, emails);

      if (suppressed.length > 0) {
        const suppressedSet = new Set(suppressed);
        let suppressedCount = 0;

        // Mark suppressed recipients as opted_out
        for (const recipient of recipients) {
          if (recipient.contact?.email && suppressedSet.has(recipient.contact.email.toLowerCase().trim())) {
            await db
              .update(crmCampaignRecipients)
              .set({
                status: 'opted_out',
                statusReason: 'Email address is on suppression list',
              })
              .where(eq(crmCampaignRecipients.id, recipient.id));
            suppressedCount++;
          }
        }

        // Filter suppressed recipients from the list
        const originalCount = recipients.length;
        recipients = recipients.filter(
          (r) => !r.contact?.email || !suppressedSet.has(r.contact.email.toLowerCase().trim())
        );

        console.log(
          `[Campaign Worker] Suppression check: ${suppressedCount} recipients suppressed, ${recipients.length} remaining (was ${originalCount})`
        );

        if (recipients.length === 0) {
          console.log('[Campaign Worker] All recipients suppressed, marking campaign as completed');
          await db
            .update(crmCampaigns)
            .set({ status: 'completed', endedAt: new Date() })
            .where(eq(crmCampaigns.id, campaignId));
          return;
        }
      }
    }
  }

  // Handle drip campaigns differently - enroll recipients and send only first message
  if (isDripCampaign) {
    console.log('[Campaign Worker] Drip campaign detected, enrolling recipients...');

    // Sort messages by sequence order
    const sequencedMessages = allMessages
      .filter((m) => m.sequenceOrder !== null)
      .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

    if (sequencedMessages.length === 0) {
      throw new Error('Drip campaign has no sequenced messages');
    }

    const firstMessage = sequencedMessages[0];

    // Enroll each recipient in the drip sequence
    for (const recipient of recipients) {
      try {
        const enrollment = await dripService.enrollRecipient(
          db,
          campaignId,
          recipient.id,
          workspaceId
        );

        // Create timeline event for enrollment
        await timelineService.create(db, {
          workspaceId,
          entityType: 'contact',
          entityId: recipient.contactId,
          eventType: 'campaign.drip_enrollment_started',
          eventCategory: 'system',
          eventLabel: 'Drip Enrollment Started',
          summary: `Enrolled in drip campaign "${campaign.name}" (${sequencedMessages.length} messages)`,
          occurredAt: new Date(),
          actorType: 'system',
          actorId: null,
          actorName: 'Campaign Worker',
          metadata: {
            campaignId,
            campaignName: campaign.name,
            enrollmentId: enrollment.id,
            totalMessages: sequencedMessages.length,
            firstMessageScheduledAt: enrollment.nextScheduledAt?.toISOString(),
          },
        });

        console.log(`[Campaign Worker] Enrolled recipient ${recipient.id} in drip sequence`);
      } catch (error) {
        console.error('[Campaign Worker] Error enrolling recipient:', recipient.id, error);
      }
    }

    console.log(`[Campaign Worker] Drip enrollments complete. Drip scheduler will handle message sending.`);
    return; // Exit - drip scheduler will handle message sending
  }

  // Create a message lookup map for A/B tests
  const messageMap = new Map(allMessages.map((m) => [m.id, m]));

  // Determine the primary channel for this campaign
  const primaryChannel = allMessages[0]?.channel || 'email';

  // Get workspace rate limit settings for the primary channel
  const smsRateLimitSettings = await SmsRateLimitService.getWorkspaceSettings(workspaceId);
  const emailRateLimitSettings = await EmailRateLimitService.getWorkspaceSettings(workspaceId);

  // Get compliance settings for CAN-SPAM footer
  const complianceSettings = await EmailSuppressionService.getComplianceSettings(workspaceId);
  const baseUrl = process.env.API_BASE_URL || 'https://api.newleads.co.za';

  let batchSize: number;
  let batchDelayMs: number;

  if (primaryChannel === 'sms' || primaryChannel === 'voice' || primaryChannel === 'whatsapp') {
    batchSize = smsRateLimitSettings.batchSize || 100;
    batchDelayMs = smsRateLimitSettings.batchDelayMs || 1000;
  } else if (primaryChannel === 'email') {
    batchSize = emailRateLimitSettings.batchSize || 100;
    batchDelayMs = emailRateLimitSettings.batchDelayMs || 500;
  } else {
    batchSize = 100;
    batchDelayMs = 1000;
  }

  console.log(`[Campaign Worker] Using batch size: ${batchSize}, delay: ${batchDelayMs}ms (channel: ${primaryChannel})`);

  let totalSentInBatch = 0;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    // For SMS campaigns, check rate limits before processing batch
    if (primaryChannel === 'sms' && smsRateLimitSettings.enabled) {
      const rateLimitCheck = await SmsRateLimitService.checkLimit(workspaceId, batch.length);
      if (!rateLimitCheck.allowed) {
        const waitMs = SmsRateLimitService.calculateWaitTime(rateLimitCheck.resetAt);
        console.log(`[Campaign Worker] SMS rate limit reached (${rateLimitCheck.current}/${rateLimitCheck.limit} per ${rateLimitCheck.windowType}). Waiting ${Math.ceil(waitMs / 1000)}s until reset...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs + 100)); // Add 100ms buffer
      }
    }

    // Phase P: For email campaigns, check rate limits before processing batch
    if (primaryChannel === 'email' && emailRateLimitSettings.enabled) {
      const rateLimitCheck = await EmailRateLimitService.checkLimit(workspaceId, batch.length);
      if (!rateLimitCheck.allowed) {
        const waitMs = EmailRateLimitService.calculateWaitTime(rateLimitCheck.resetAt);
        console.log(`[Campaign Worker] Email rate limit reached (${rateLimitCheck.current}/${rateLimitCheck.limit} per ${rateLimitCheck.windowType}). Waiting ${Math.ceil(waitMs / 1000)}s until reset...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs + 100));
      }
    }

    await Promise.all(
      batch.map(async (recipient) => {
        try {
          // Determine which message to send for this recipient
          let recipientMessage = allMessages[0]; // Default to first message
          if (isAbTestCampaign && recipient.messageId) {
            recipientMessage = messageMap.get(recipient.messageId) || recipientMessage;
          } else if (messageId) {
            // If specific message ID provided, use it
            recipientMessage = messageMap.get(messageId) || recipientMessage;
          }

          // Replace merge tags
          const subject = replaceMergeTags(recipientMessage.subject || '', recipient.contact, recipientMessage.fallbackValues || {});
          const body = replaceMergeTags(
            recipientMessage.bodyHtml || recipientMessage.bodyText,
            recipient.contact,
            recipientMessage.fallbackValues || {}
          );

          // Check sandbox mode
          const isSandbox = await sandboxService.isSandboxEnabled(workspaceId, campaign.testMode);

          // Send via appropriate channel
          let result: any;
          let vendorMsgId: string; // Renamed to avoid bundler collision with outer messageId

          // Sandbox: fully intercept email/sms/whatsapp
          if (isSandbox && (recipientMessage.channel === 'email' || recipientMessage.channel === 'sms' || recipientMessage.channel === 'whatsapp')) {
            const sandboxMsg: OutboundMessage = {
              to: recipientMessage.channel === 'email' ? recipient.contact.email : recipient.contact.phone,
              content: body,
              subject,
              workspaceId,
              campaignId,
              recipientId: recipient.id,
              contactId: recipient.contactId,
              channel: recipientMessage.channel,
              channelOptions: recipientMessage.channel === 'email' ? {
                email: {
                  html: recipientMessage.bodyHtml || body,
                  from: recipientMessage.sendFromEmail || undefined,
                  fromName: recipientMessage.sendFromName || undefined,
                  replyTo: recipientMessage.replyToEmail || undefined,
                },
              } : undefined,
            };

            let sandboxAdapter: any;
            if (recipientMessage.channel === 'email') {
              if (!sandboxEmailAdapter) sandboxEmailAdapter = new SandboxEmailAdapter();
              sandboxAdapter = sandboxEmailAdapter;
            } else {
              // SMS and WhatsApp both use the SMS sandbox adapter
              if (!sandboxSmsAdapter) sandboxSmsAdapter = new SandboxSmsAdapter();
              sandboxAdapter = sandboxSmsAdapter;
            }

            const sandboxResult = await sandboxAdapter.send(sandboxMsg);
            if (!sandboxResult.success) {
              throw new Error(sandboxResult.error || 'Sandbox send failed');
            }
            vendorMsgId = sandboxResult.messageId;
          }
          // Sandbox: voice/ai_voice — swap number but make real call
          else if (isSandbox && (recipientMessage.channel === 'voice' || recipientMessage.channel === 'ai_voice')) {
            const sandboxConfig = await sandboxService.getConfig(workspaceId);
            const testNumber = sandboxConfig?.voiceTestNumber;
            if (!testNumber) {
              throw new Error('Sandbox voice test number not configured. Set sandbox.voiceTestNumber in workspace settings.');
            }

            if (recipientMessage.channel === 'voice') {
              const voiceAdapter = getTwilioVoice();
              if (!voiceAdapter) throw new Error('Voice adapter not available');
              const decorator = new SandboxVoiceAdapter(voiceAdapter, testNumber);
              const voiceResult = await decorator.send({
                to: recipient.contact.phone,
                content: body,
                workspaceId,
                campaignId,
                recipientId: recipient.id,
                contactId: recipient.contactId,
              });
              if (!voiceResult.success) throw new Error(voiceResult.error || 'Sandbox voice call failed');
              vendorMsgId = voiceResult.messageId;
            } else {
              // ai_voice — queue will handle the actual call, but we need to record the swap
              // For now, queue normally but note the sandbox status
              // The queue worker would need similar sandbox logic for ai_voice
              if (!recipient.contact.phone) throw new Error('Contact has no phone number');
              const aiCallConfig = (recipientMessage as any).aiCallConfig as AiCallConfig | null;
              let preferredHoursStart: string | undefined;
              let preferredHoursEnd: string | undefined;
              if (aiCallConfig?.preferredHours) {
                const [start, end] = aiCallConfig.preferredHours.split('-');
                preferredHoursStart = start;
                preferredHoursEnd = end;
              }
              const [queueItem] = await db.insert(crmAiVoiceQueue).values({
                workspaceId,
                campaignId,
                recipientId: recipient.id,
                aiScriptId: (recipientMessage as any).aiScriptId,
                toNumber: testNumber, // Swap to test number
                contactId: recipient.contactId,
                status: 'pending',
                priority: 0,
                maxAttempts: aiCallConfig?.maxAttempts ?? AI_VOICE_DEFAULTS.maxAttempts,
                preferredHoursStart: preferredHoursStart ?? AI_VOICE_DEFAULTS.preferredHours.split('-')[0],
                preferredHoursEnd: preferredHoursEnd ?? AI_VOICE_DEFAULTS.preferredHours.split('-')[1],
                timezone: aiCallConfig?.timezone ?? AI_VOICE_DEFAULTS.timezone,
              }).returning();

              // Also store in sandbox tracking
              await sandboxService.storeMessage({
                workspaceId,
                channel: 'ai_voice',
                direction: 'outbound',
                to: recipient.contact.phone, // Track real contact
                from: 'AI Agent',
                content: body,
                campaignId,
                recipientId: recipient.id,
                contactId: recipient.contactId,
                voiceMetadata: { originalTo: recipient.contact.phone, isRealCall: true },
                metadata: { testNumber, queueItemId: queueItem.id },
              });

              vendorMsgId = queueItem.id;
              await db.update(crmCampaignRecipients).set({
                status: 'queued' as any,
                statusReason: 'Queued for sandbox AI voice call (test number)',
              }).where(eq(crmCampaignRecipients.id, recipient.id));
              return; // Skip normal status update
            }
          }
          // Production path — no sandbox
          else switch (recipientMessage.channel) {
            case 'email':
              // Phase P: Generate unsubscribe URL and CAN-SPAM footer
              const unsubscribeUrl = EmailSuppressionService.generateUnsubscribeUrl({
                baseUrl,
                workspaceId,
                email: recipient.contact.email,
                campaignId,
              });
              const complianceFooter = EmailSuppressionService.generateComplianceFooter({
                unsubscribeUrl,
                companyName: complianceSettings.companyName,
                physicalAddress: complianceSettings.physicalAddress,
              });
              const emailBody = body + complianceFooter;

              // Send email via Resend with List-Unsubscribe headers
              result = await resendProvider.sendEmail({
                to: recipient.contact.email,
                subject,
                html: emailBody,
                from: recipientMessage.sendFromEmail ? `${recipientMessage.sendFromName || 'NewLeads CRM'} <${recipientMessage.sendFromEmail}>` : undefined,
                replyTo: recipientMessage.replyToEmail || 'reply@newleads.co.za',
                tags: {
                  campaign_id: campaignId,
                  message_id: recipientMessage.id,
                  recipient_id: recipient.id,
                  workspace_id: workspaceId,
                  variant_name: recipient.variantName || recipientMessage.variantName || 'A',
                },
                headers: {
                  'List-Unsubscribe': `<${unsubscribeUrl}>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                },
              });
              vendorMsgId = result.id;
              break;

            case 'sms':
              // Send SMS via Twilio
              const smsAdapter = getTwilioSMS();
              if (!smsAdapter) {
                throw new Error('SMS adapter not available - check Twilio credentials');
              }

              if (!recipient.contact.phone) {
                throw new Error('Contact has no phone number');
              }

              // Use SendSMSParams format for the adapter's send() method
              // workspaceId enables per-workspace phone number configuration
              const smsResult = await smsAdapter.send({
                to: recipient.contact.phone,
                message: body, // Plain text content
                workspaceId, // For phone number resolution (workspace settings → env var)
                metadata: {
                  workspaceId,
                  campaignId,
                  recipientId: recipient.id,
                  contactId: recipient.contactId,
                  testMode: campaign.testMode ? 'true' : 'false',
                },
              });
              if (!smsResult.success) {
                // Extract error message from error object
                const errorMsg = typeof smsResult.error === 'object'
                  ? smsResult.error?.message
                  : smsResult.error;
                throw new Error(errorMsg || 'SMS send failed');
              }
              vendorMsgId = smsResult.messageId;
              break;

            case 'voice':
              // Initiate voice call via Twilio
              const voiceAdapter = getTwilioVoice();
              if (!voiceAdapter) {
                throw new Error('Voice adapter not available - check Twilio credentials');
              }

              if (!recipient.contact.phone) {
                throw new Error('Contact has no phone number');
              }

              const voiceMessage: OutboundMessage = {
                to: recipient.contact.phone,
                content: body, // Voice content (will be converted to speech)
                workspaceId,
                campaignId,
                recipientId: recipient.id,
                contactId: recipient.contactId,
              };

              const voiceResult = await voiceAdapter.send(voiceMessage);
              if (!voiceResult.success) {
                throw new Error(voiceResult.error || 'Voice call failed');
              }
              vendorMsgId = voiceResult.messageId;
              break;

            case 'whatsapp':
              // Send WhatsApp message via Twilio
              const whatsappAdapter = getTwilioWhatsApp();
              if (!whatsappAdapter) {
                throw new Error('WhatsApp adapter not available - check Twilio credentials');
              }

              if (!recipient.contact.phone) {
                throw new Error('Contact has no phone number');
              }

              const whatsappMessage: OutboundMessage = {
                to: recipient.contact.phone,
                content: body,
                workspaceId,
                campaignId,
                recipientId: recipient.id,
                contactId: recipient.contactId,
              };

              const whatsappResult = await whatsappAdapter.send(whatsappMessage);
              if (!whatsappResult.success) {
                throw new Error(whatsappResult.error || 'WhatsApp send failed');
              }
              vendorMsgId = whatsappResult.messageId;
              break;

            case 'ai_voice':
              // AI voice calls are handled by a separate queue worker
              // Queue the call for sequential processing
              if (!recipient.contact.phone) {
                throw new Error('Contact has no phone number');
              }

              // Parse AI call config from message
              const aiCallConfig = (recipientMessage as any).aiCallConfig as AiCallConfig | null;

              // Parse preferred hours
              let preferredHoursStart: string | undefined;
              let preferredHoursEnd: string | undefined;
              if (aiCallConfig?.preferredHours) {
                const [start, end] = aiCallConfig.preferredHours.split('-');
                preferredHoursStart = start;
                preferredHoursEnd = end;
              }

              // Insert into AI voice queue
              const [queueItem] = await db.insert(crmAiVoiceQueue).values({
                workspaceId,
                campaignId,
                recipientId: recipient.id,
                aiScriptId: (recipientMessage as any).aiScriptId,
                toNumber: recipient.contact.phone,
                contactId: recipient.contactId,
                status: 'pending',
                priority: 0,
                maxAttempts: aiCallConfig?.maxAttempts ?? AI_VOICE_DEFAULTS.maxAttempts,
                preferredHoursStart: preferredHoursStart ?? AI_VOICE_DEFAULTS.preferredHours.split('-')[0],
                preferredHoursEnd: preferredHoursEnd ?? AI_VOICE_DEFAULTS.preferredHours.split('-')[1],
                timezone: aiCallConfig?.timezone ?? AI_VOICE_DEFAULTS.timezone,
              }).returning();

              vendorMsgId = queueItem.id; // Use queue item ID as reference

              // Update recipient status to 'queued' (will be updated to 'sent' when call is made)
              await db
                .update(crmCampaignRecipients)
                .set({
                  status: 'queued' as any,
                  statusReason: 'Queued for AI voice call',
                })
                .where(eq(crmCampaignRecipients.id, recipient.id));

              // Skip the normal status update below (return instead of continue since we're in a map callback)
              return;

            default:
              throw new Error(`Unsupported channel: ${recipientMessage.channel}`);
          }

          // Update recipient status
          await db
            .update(crmCampaignRecipients)
            .set({
              status: 'sent',
              sentAt: new Date(),
              resendEmailId: recipientMessage.channel === 'email' ? vendorMsgId : null,
            })
            .where(eq(crmCampaignRecipients.id, recipient.id));

          totalSentInBatch++;

          // Timeline event
          const channelLabel = recipientMessage.channel.toUpperCase();
          await timelineService.create(db, {
            workspaceId,
            entityType: 'contact',
            entityId: recipient.contactId,
            eventType: `campaign.${recipientMessage.channel}_sent`,
            eventCategory: 'system',
            eventLabel: `${channelLabel} Sent`,
            summary: `${channelLabel} campaign message "${recipientMessage.name}" sent${recipient.variantName ? ` (Variant ${recipient.variantName})` : ''}`,
            occurredAt: new Date(),
            actorType: 'system',
            actorId: null,
            actorName: 'Campaign Worker',
            metadata: {
              campaignId,
              campaignName: campaign.name,
              messageId: recipientMessage.id,
              messageName: recipientMessage.name,
              recipientId: recipient.id,
              vendorMessageId: vendorMsgId,
              channel: recipientMessage.channel,
              variantName: recipient.variantName,
              isAbTest: isAbTestCampaign,
              testMode: campaign.testMode,
            },
          });
        } catch (error) {
          console.error('[Campaign Worker] Error sending to recipient:', recipient.id, error);
          await db
            .update(crmCampaignRecipients)
            .set({
              status: 'failed',
              statusReason: error instanceof Error ? error.message : 'Unknown error',
            })
            .where(eq(crmCampaignRecipients.id, recipient.id));
        }
      })
    );

    // Count SMS messages sent in this batch for rate limiting
    const smsSentInBatch = batch.filter((r) => {
      const msg = isAbTestCampaign && r.messageId ? messageMap.get(r.messageId) : allMessages[0];
      return msg?.channel === 'sms';
    }).length;

    // Increment SMS rate limit counter if any SMS were sent
    if (smsSentInBatch > 0 && smsRateLimitSettings.enabled) {
      await SmsRateLimitService.incrementCounter(workspaceId, smsSentInBatch);
      console.log(`[Campaign Worker] Incremented SMS rate limit counter by ${smsSentInBatch}`);
    }

    // Phase P: Increment email rate limit counter if any emails were sent
    const emailSentInBatch = batch.filter((r) => {
      const msg = isAbTestCampaign && r.messageId ? messageMap.get(r.messageId) : allMessages[0];
      return msg?.channel === 'email';
    }).length;

    if (emailSentInBatch > 0 && emailRateLimitSettings.enabled) {
      await EmailRateLimitService.incrementCounter(workspaceId, emailSentInBatch);
      console.log(`[Campaign Worker] Incremented email rate limit counter by ${emailSentInBatch}`);
    }

    // Update campaign stats after each batch
    await db
      .update(crmCampaigns)
      .set({
        totalSent: campaign.totalSent + totalSentInBatch,
        updatedAt: new Date(),
      })
      .where(eq(crmCampaigns.id, campaignId));

    console.log(`[Campaign Worker] Sent batch ${Math.floor(i / batchSize) + 1}, total sent: ${totalSentInBatch}`);

    // Rate limiting delay between batches (use workspace settings for SMS campaigns)
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  // Check if this is an AI voice campaign (needs queue processing)
  if (primaryChannel === 'ai_voice') {
    console.log(`[Campaign Worker] AI voice campaign ${campaignId} - recipients queued, triggering queue processing`);

    // Trigger the AI voice queue processing job
    await jobQueue.send('process-ai-voice-queue', {
      workspaceId,
      campaignId,
    });

    // Timeline event for queuing
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: campaignId,
      eventType: 'campaign.ai_voice_queued',
      eventCategory: 'system',
      eventLabel: 'AI Voice Campaign Queued',
      summary: `AI voice campaign "${campaign.name}" queued for processing (${recipients.length} recipients)`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'Campaign Worker',
      metadata: {
        campaignId,
        campaignName: campaign.name,
        totalRecipients: recipients.length,
      },
    });

    // Don't mark as completed - queue worker handles this
    return;
  }

  // Mark campaign as completed (for one-time campaigns)
  // For recurring campaigns, keep status as 'active'
  if (campaign.type !== 'recurring') {
    await db
      .update(crmCampaigns)
      .set({ status: 'completed', endedAt: new Date() })
      .where(eq(crmCampaigns.id, campaignId));
  }

  // Timeline event for completion
  await timelineService.create(db, {
    workspaceId,
    entityType: 'contact',
    entityId: campaignId, // Link to campaign (we'll filter by metadata)
    eventType: 'campaign.completed',
    eventCategory: 'system',
    eventLabel: 'Campaign Completed',
    summary: `Campaign "${campaign.name}" completed`,
    occurredAt: new Date(),
    actorType: 'system',
    actorId: null,
    actorName: 'Campaign Worker',
    metadata: {
      campaignId,
      campaignName: campaign.name,
      totalRecipients: recipients.length,
      totalSent: totalSentInBatch,
    },
  });

  console.log(`[Campaign Worker] Campaign ${campaignId} completed successfully`);
}

/**
 * Replace merge tags in template
 * Supports {{field}} and {{field|default:"value"}} syntax
 */
function replaceMergeTags(template: string, contact: any, fallbackValues: any): string {
  return template.replace(/\{\{(\w+)(?:\|default:"([^"]+)")?\}\}/g, (match, field, defaultValue) => {
    const value = contact[field] || fallbackValues[field] || defaultValue || match;
    return String(value);
  });
}

/**
 * Register the campaign execution worker
 */
export async function registerExecuteCampaignWorker(): Promise<void> {
  await jobQueue.work<ExecuteCampaignJob>(
    'execute-campaign',
    {
      teamSize: 2, // Run 2 workers in parallel
      teamConcurrency: 1, // Each worker processes 1 job at a time
    },
    async (job) => {
      await executeCampaign(job.data);
    }
  );
}
