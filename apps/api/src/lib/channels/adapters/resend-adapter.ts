/**
 * Resend Email Channel Adapter
 * Handles email sending and webhook processing via Resend
 */

import { BaseChannelAdapter } from '../base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import { getResendProvider } from '../../providers/resend';

/**
 * ResendAdapter
 *
 * Email channel adapter using Resend as the provider
 */
export class ResendAdapter extends BaseChannelAdapter {
  private resendProvider: ReturnType<typeof getResendProvider>;

  constructor() {
    super('email', 'resend');
    this.resendProvider = getResendProvider();
  }

  getSupportedEventTypes(): string[] {
    return ['sent', 'delivered', 'bounced', 'opened', 'clicked', 'delivery_delayed'];
  }

  /**
   * Send email via Resend
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const emailOptions = message.channelOptions?.email;

    // Build tags object with only non-empty values (Resend doesn't allow empty strings)
    const tags: Record<string, string> = {};
    if (message.campaignId) tags.campaign_id = message.campaignId;
    if (message.recipientId) tags.recipient_id = message.recipientId;
    if (message.workspaceId) tags.workspace_id = message.workspaceId;
    if (message.contactId) tags.contact_id = message.contactId;
    if (message.leadId) tags.lead_id = message.leadId;

    const result = await this.resendProvider.sendEmail({
      to: message.to,
      subject: message.subject || 'No Subject',
      html: emailOptions?.html || message.content,
      from: emailOptions?.from
        ? `${emailOptions.fromName || 'NewLeads CRM'} <${emailOptions.from}>`
        : undefined,
      replyTo: emailOptions?.replyTo,
      tags: Object.keys(tags).length > 0 ? tags : undefined,
    });

    return {
      success: true,
      messageId: result.id,
      channel: 'email',
      metadata: {
        resendEmailId: result.id,
      },
    };
  }

  /**
   * Transform Resend webhook to unified format
   */
  protected async transformWebhook(
    rawPayload: any,
    headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    const event = rawPayload as {
      type:
        | 'email.sent'
        | 'email.delivered'
        | 'email.bounced'
        | 'email.opened'
        | 'email.clicked'
        | 'email.delivery_delayed';
      created_at: string;
      data: {
        email_id: string;
        to: string;
        from: string;
        subject?: string;
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
          contact_id?: string;
          lead_id?: string;
        };
      };
    };

    // Map Resend event type to our generic type
    const eventTypeMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.delivery_delayed': 'delayed',
    };

    const genericEventType = eventTypeMap[event.type] || 'unknown';

    // Build unified event
    const unifiedEvent: UnifiedWebhookEvent = {
      eventId: '', // Will be set by router
      vendorEventId: event.data.email_id,
      channel: 'email',
      eventType: genericEventType,
      direction: 'outbound', // Resend only handles outbound
      from: event.data.from,
      to: event.data.to,
      subject: event.data.subject,
      campaignId: event.data.tags?.campaign_id,
      recipientId: event.data.tags?.recipient_id,
      contactId: event.data.tags?.contact_id,
      leadId: event.data.tags?.lead_id,
      workspaceId: event.data.tags?.workspace_id || '', // Required field
      occurredAt: new Date(event.created_at),
      metadata: {
        vendor: 'resend',
        rawEventType: event.type,
      },
    };

    // Add email-specific data
    if (event.data.bounce) {
      unifiedEvent.email = {
        bounceType: event.data.bounce.type,
        bounceDescription: event.data.bounce.description,
      };
    }

    if (event.data.click) {
      unifiedEvent.email = {
        ...(unifiedEvent.email || {}),
        linkUrl: event.data.click.link,
      };
    }

    return unifiedEvent;
  }

  /**
   * Validate Resend webhook signature
   *
   * Note: Resend uses webhook signing (optional)
   * For now, we'll accept all webhooks in development
   * In production, you should implement signature verification
   */
  protected validateWebhookSignature(payload: any, headers: Record<string, string>): boolean {
    // TODO: Implement Resend webhook signature verification
    // See: https://resend.com/docs/webhooks#verifying-webhook-signatures

    const signature = headers['resend-signature'] || headers['Resend-Signature'];

    if (!signature) {
      // In development, allow unsigned webhooks
      if (process.env.NODE_ENV === 'development') {
        this.log('warn', 'No Resend signature found, allowing in development mode');
        return true;
      }

      this.log('error', 'Missing Resend signature header');
      return false;
    }

    // In development, accept any signature
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // TODO: Verify signature in production
    // const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    // const isValid = verifyResendSignature(payload, signature, webhookSecret);
    // return isValid;

    this.log('warn', 'Resend signature verification not implemented, accepting webhook');
    return true;
  }
}
