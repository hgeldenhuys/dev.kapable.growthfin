/**
 * Mock Twilio SMS Adapter
 *
 * Simulates Twilio SMS sending in TEST_MODE.
 * Logs SMS to database instead of sending via Twilio API.
 * Auto-generates webhook events with realistic timing.
 */

import { BaseChannelAdapter } from '../../lib/channels/base-adapter';
import type {
  OutboundMessage,
  SendResult,
  UnifiedWebhookEvent,
  SendSMSParams,
  SMSResult,
} from '../../lib/channels/types';
import { createMockMessage, isTestModeEnabled } from './webhook-server';
import { validatePhoneNumber } from '../../lib/utils/phone-validation';

/**
 * MockTwilioSMSAdapter
 *
 * SMS channel adapter that mocks Twilio behavior for testing.
 * Stores messages in database and simulates webhook events.
 */
export class MockTwilioSMSAdapter extends BaseChannelAdapter {
  private fromNumber: string;

  constructor() {
    super('sms', 'mock-twilio');
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550006';
  }

  getSupportedEventTypes(): string[] {
    return ['sms.sent', 'sms.delivered', 'sms.failed', 'sms.received', 'sms.queued', 'sms.undelivered'];
  }

  /**
   * Send SMS via mock (stores in database, generates events)
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const smsOptions = message.channelOptions?.sms;
    const from = smsOptions?.from || this.fromNumber;

    // Create mock message in database
    const { messageId } = await createMockMessage({
      workspaceId: message.workspaceId,
      channel: 'sms',
      to: message.to,
      from,
      content: message.content,
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      contactId: message.contactId,
      leadId: message.leadId,
      metadata: {
        mock: true,
        testMode: true,
        originalAdapter: 'twilio',
        segments: this.calculateSegments(message.content),
      },
    });

    this.log('info', `[MOCK] SMS sent to ${message.to}`, {
      messageId,
      segments: this.calculateSegments(message.content),
      testMode: true,
    });

    return {
      success: true,
      messageId,
      channel: 'sms',
      metadata: {
        mock: true,
        twilioSid: messageId,
        status: 'queued',
        from,
        to: message.to,
        segments: this.calculateSegments(message.content),
      },
    };
  }

  /**
   * Send SMS with full control over parameters
   */
  async send(params: SendSMSParams): Promise<SMSResult> {
    // Validate phone number
    const phoneValidation = validatePhoneNumber(params.to);
    if (!phoneValidation.valid) {
      return {
        success: false,
        messageId: '',
        segments: 0,
        provider: 'mock-twilio',
        error: {
          code: 'INVALID_PHONE',
          message: phoneValidation.error || 'Invalid phone number',
        },
      };
    }

    // Calculate segments
    const segments = this.calculateSegments(params.message);

    // For mock mode, we don't have workspaceId, so generate a simple ID
    const messageId = `mock_sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.log('info', `[MOCK] Direct SMS sent to ${params.to}`, {
      messageId,
      segments,
    });

    return {
      success: true,
      messageId,
      segments,
      provider: 'mock-twilio',
    };
  }

  /**
   * Calculate SMS segments
   */
  private calculateSegments(message: string): number {
    const length = message.length;
    if (length === 0) return 0;

    // Detect if Unicode is needed
    const isUnicode = /[^\x00-\x7F]/.test(message);

    if (isUnicode) {
      if (length <= 70) return 1;
      return Math.ceil(length / 67);
    } else {
      if (length <= 160) return 1;
      return Math.ceil(length / 153);
    }
  }

  /**
   * Transform mock webhook to unified format
   */
  protected async transformWebhook(
    rawPayload: any,
    headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    const messageSid = rawPayload.MessageSid || rawPayload.SmsSid;
    const messageStatus = rawPayload.MessageStatus || rawPayload.SmsStatus;
    const from = rawPayload.From;
    const to = rawPayload.To;
    const body = rawPayload.Body;
    const errorCode = rawPayload.ErrorCode;

    // Determine if this is inbound or outbound
    const isInbound = !messageStatus;
    const direction: 'inbound' | 'outbound' = isInbound ? 'inbound' : 'outbound';

    // Map status to event type
    let eventType = 'sms.unknown';
    if (isInbound) {
      eventType = 'sms.received';
    } else {
      const statusMap: Record<string, string> = {
        queued: 'sms.queued',
        sent: 'sms.sent',
        delivered: 'sms.delivered',
        failed: 'sms.failed',
        undelivered: 'sms.undelivered',
      };
      eventType = statusMap[messageStatus?.toLowerCase()] || 'sms.unknown';
    }

    const unifiedEvent: UnifiedWebhookEvent = {
      eventId: `${messageSid}-${Date.now()}`,
      eventType,
      occurredAt: new Date(),
      channel: 'sms',
      vendor: 'mock-twilio',
      direction,
      recipient: { to, from },
      vendorMessageId: messageSid,
      status: messageStatus || 'received',
      content: body,
      metadata: {
        mock: true,
        messageSid,
        segments: parseInt(rawPayload.NumSegments || '1', 10),
        carrierStatus: messageStatus,
        errorCode,
        recipientId: rawPayload.RecipientId,
        contactId: rawPayload.ContactId,
        campaignId: rawPayload.CampaignId,
        workspaceId: rawPayload.WorkspaceId || '',
      },
      rawPayload,
    };

    return unifiedEvent;
  }

  /**
   * Always validate in test mode
   */
  protected validateWebhookSignature(
    payload: any,
    headers: Record<string, string>,
    rawBody?: string
  ): boolean {
    // In test mode, always accept
    return true;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let mockTwilioSMSAdapter: MockTwilioSMSAdapter | null = null;

export function getMockTwilioSMSAdapter(): MockTwilioSMSAdapter {
  if (!mockTwilioSMSAdapter) {
    mockTwilioSMSAdapter = new MockTwilioSMSAdapter();
  }
  return mockTwilioSMSAdapter;
}
