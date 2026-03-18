/**
 * Mock Resend Adapter
 *
 * Simulates Resend email sending in TEST_MODE.
 * Logs emails to database instead of sending via Resend API.
 * Auto-generates webhook events with realistic timing.
 */

import { BaseChannelAdapter } from '../../lib/channels/base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../../lib/channels/types';
import { createMockMessage, isTestModeEnabled } from './webhook-server';

/**
 * MockResendAdapter
 *
 * Email channel adapter that mocks Resend behavior for testing.
 * Stores messages in database and simulates webhook events.
 */
export class MockResendAdapter extends BaseChannelAdapter {
  constructor() {
    super('email', 'mock-resend');
  }

  getSupportedEventTypes(): string[] {
    return ['sent', 'delivered', 'bounced', 'opened', 'clicked', 'delivery_delayed'];
  }

  /**
   * Send email via mock (stores in database, generates events)
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const emailOptions = message.channelOptions?.email;

    // Create mock message in database
    const { messageId } = await createMockMessage({
      workspaceId: message.workspaceId,
      channel: 'email',
      to: message.to,
      from: emailOptions?.from
        ? `${emailOptions.fromName || 'NewLeads CRM'} <${emailOptions.from}>`
        : process.env.RESEND_FROM_EMAIL || 'test@example.com',
      subject: message.subject || 'No Subject',
      content: emailOptions?.html || message.content,
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      contactId: message.contactId,
      leadId: message.leadId,
      metadata: {
        mock: true,
        testMode: true,
        originalAdapter: 'resend',
        tags: {
          campaign_id: message.campaignId,
          recipient_id: message.recipientId,
          workspace_id: message.workspaceId,
          contact_id: message.contactId,
          lead_id: message.leadId,
        },
      },
    });

    this.log('info', `[MOCK] Email sent to ${message.to}`, {
      messageId,
      subject: message.subject,
      testMode: true,
    });

    return {
      success: true,
      messageId,
      channel: 'email',
      metadata: {
        mock: true,
        resendEmailId: messageId,
      },
    };
  }

  /**
   * Transform mock webhook to unified format
   */
  protected async transformWebhook(
    rawPayload: any,
    headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    const event = rawPayload;

    // Map event type
    const eventTypeMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.delivery_delayed': 'delayed',
    };

    const genericEventType = eventTypeMap[event.type] || 'unknown';

    const unifiedEvent: UnifiedWebhookEvent = {
      eventId: '',
      vendorEventId: event.data?.email_id || event.id,
      channel: 'email',
      eventType: genericEventType,
      direction: 'outbound',
      from: event.data?.from || '',
      to: event.data?.to || '',
      subject: event.data?.subject,
      campaignId: event.data?.tags?.campaign_id,
      recipientId: event.data?.tags?.recipient_id,
      contactId: event.data?.tags?.contact_id,
      leadId: event.data?.tags?.lead_id,
      workspaceId: event.data?.tags?.workspace_id || '',
      occurredAt: new Date(event.created_at || Date.now()),
      metadata: {
        vendor: 'mock-resend',
        mock: true,
        rawEventType: event.type,
      },
    };

    // Add email-specific data
    if (event.data?.bounce) {
      unifiedEvent.email = {
        bounceType: event.data.bounce.type,
        bounceDescription: event.data.bounce.description,
      };
    }

    if (event.data?.click) {
      unifiedEvent.email = {
        ...(unifiedEvent.email || {}),
        linkUrl: event.data.click.link,
      };
    }

    return unifiedEvent;
  }

  /**
   * Always validate in test mode (no signature required)
   */
  protected validateWebhookSignature(payload: any, headers: Record<string, string>): boolean {
    // In test mode, always accept
    return true;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let mockResendAdapter: MockResendAdapter | null = null;

export function getMockResendAdapter(): MockResendAdapter {
  if (!mockResendAdapter) {
    mockResendAdapter = new MockResendAdapter();
  }
  return mockResendAdapter;
}
