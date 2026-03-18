/**
 * Sandbox SMS Adapter
 * Fully intercepts SMS sending — never hits Twilio.
 * Stores message in crm_mock_messages for dashboard viewing.
 */

import { BaseChannelAdapter } from '../base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import { sandboxService } from '../sandbox-service';

export class SandboxSmsAdapter extends BaseChannelAdapter {
  constructor() {
    super('sms', 'sandbox-sms');
  }

  getSupportedEventTypes(): string[] {
    return ['sent', 'delivered', 'failed', 'received'];
  }

  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const smsOptions = message.channelOptions?.sms;

    const messageId = await sandboxService.storeMessage({
      workspaceId: message.workspaceId,
      channel: message.channel || 'sms',
      direction: 'outbound',
      to: message.to,
      from: smsOptions?.from || process.env.TWILIO_PHONE_NUMBER || '+10000000000',
      content: message.content,
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      contactId: message.contactId,
      leadId: message.leadId,
    });

    return {
      success: true,
      messageId,
      channel: message.channel || 'sms',
      metadata: { sandbox: true },
    };
  }

  /**
   * Also support the legacy send() signature used by execute-campaign
   * which calls smsAdapter.send({ to, message, workspaceId, metadata })
   */
  async send(params: any): Promise<SendResult> {
    // Handle both OutboundMessage format and legacy SendSMSParams format
    if ('message' in params && !('content' in params)) {
      return super.send({
        to: params.to,
        content: params.message,
        workspaceId: params.workspaceId || params.metadata?.workspaceId || '',
        campaignId: params.metadata?.campaignId,
        recipientId: params.metadata?.recipientId,
        contactId: params.metadata?.contactId,
        channel: params.channel || params.metadata?.channel,
        channelOptions: { sms: { from: params.from } },
      });
    }
    return super.send(params);
  }

  protected async transformWebhook(
    _rawPayload: any,
    _headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    throw new Error('Sandbox SMS adapter does not process real webhooks');
  }

  protected validateWebhookSignature(
    _payload: any,
    _headers: Record<string, string>
  ): boolean {
    return false;
  }
}
