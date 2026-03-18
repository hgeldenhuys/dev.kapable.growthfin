/**
 * Sandbox Voice Adapter (Decorator)
 * Wraps the real TwilioVoiceAdapter — the call actually goes through,
 * but the `to` number is swapped to the workspace's test phone number.
 * CRM tracks against the real contact.
 */

import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import type { BaseChannelAdapter } from '../base-adapter';
import { sandboxService } from '../sandbox-service';

export class SandboxVoiceAdapter {
  private realAdapter: BaseChannelAdapter;
  private testNumber: string;

  constructor(realAdapter: BaseChannelAdapter, testNumber: string) {
    this.realAdapter = realAdapter;
    this.testNumber = testNumber;
  }

  getChannelType() {
    return this.realAdapter.getChannelType();
  }

  getVendorName() {
    return `sandbox-${this.realAdapter.getVendorName()}`;
  }

  getSupportedEventTypes() {
    return this.realAdapter.getSupportedEventTypes();
  }

  getWebhookPath() {
    return this.realAdapter.getWebhookPath();
  }

  validateWebhook(payload: any, headers: Record<string, string>) {
    return this.realAdapter.validateWebhook(payload, headers);
  }

  async processWebhook(rawPayload: any, headers?: Record<string, string>) {
    return this.realAdapter.processWebhook(rawPayload, headers);
  }

  /**
   * Send voice call — swap `to` to test number, delegate to real adapter.
   * Store the original `to` in crm_mock_messages for tracking.
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    const originalTo = message.to;

    // Swap the recipient to the test number
    const sandboxMessage: OutboundMessage = {
      ...message,
      to: this.testNumber,
    };

    // Send via real adapter (call actually happens to test number)
    const result = await this.realAdapter.send(sandboxMessage);

    // Store in sandbox tracking
    await sandboxService.storeMessage({
      workspaceId: message.workspaceId,
      channel: this.realAdapter.getChannelType() as any,
      direction: 'outbound',
      to: originalTo, // Track against real contact
      from: message.channelOptions?.voice?.from || process.env.TWILIO_PHONE_NUMBER || '',
      content: message.content,
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      contactId: message.contactId,
      leadId: message.leadId,
      voiceMetadata: {
        originalTo,
        isRealCall: true,
        duration: 0,
        recordingUrl: result.metadata?.recordingUrl,
      },
      metadata: {
        sandbox: true,
        vendorMessageId: result.messageId,
        testNumber: this.testNumber,
      },
    });

    return result;
  }
}
