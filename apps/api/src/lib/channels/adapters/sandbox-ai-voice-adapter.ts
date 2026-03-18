/**
 * Sandbox AI Voice Adapter (Decorator)
 * Wraps the real ElevenLabsVoiceAdapter — the call actually goes through,
 * but the `to` number is swapped to the workspace's test phone number.
 * CRM tracks against the real contact.
 */

import type { OutboundMessage, SendResult } from '../types';
import type { BaseChannelAdapter } from '../base-adapter';
import { sandboxService } from '../sandbox-service';

export class SandboxAiVoiceAdapter {
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
   * Send AI voice call — swap `to` to test number, delegate to real adapter.
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    const originalTo = message.to;

    const sandboxMessage: OutboundMessage = {
      ...message,
      to: this.testNumber,
    };

    const result = await this.realAdapter.send(sandboxMessage);

    await sandboxService.storeMessage({
      workspaceId: message.workspaceId,
      channel: 'ai_voice',
      direction: 'outbound',
      to: originalTo,
      from: 'AI Agent',
      content: message.content,
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      contactId: message.contactId,
      leadId: message.leadId,
      voiceMetadata: {
        originalTo,
        isRealCall: true,
        duration: 0,
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
