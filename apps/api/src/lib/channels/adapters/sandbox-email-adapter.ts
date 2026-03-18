/**
 * Sandbox Email Adapter
 * Fully intercepts email sending — never hits Resend.
 * Stores message in crm_mock_messages for dashboard viewing.
 */

import { BaseChannelAdapter } from '../base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import { sandboxService } from '../sandbox-service';

export class SandboxEmailAdapter extends BaseChannelAdapter {
  constructor() {
    super('email', 'sandbox-email');
  }

  getSupportedEventTypes(): string[] {
    return ['sent', 'delivered', 'bounced', 'opened', 'clicked'];
  }

  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const emailOptions = message.channelOptions?.email;

    const messageId = await sandboxService.storeMessage({
      workspaceId: message.workspaceId,
      channel: 'email',
      direction: 'outbound',
      to: message.to,
      from: emailOptions?.from || 'sandbox@growthfin.app',
      content: message.content,
      contentHtml: emailOptions?.html || message.content,
      subject: message.subject || 'No Subject',
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      contactId: message.contactId,
      leadId: message.leadId,
      metadata: {
        fromName: emailOptions?.fromName,
        replyTo: emailOptions?.replyTo,
      },
    });

    return {
      success: true,
      messageId,
      channel: 'email',
      metadata: { sandbox: true },
    };
  }

  protected async transformWebhook(
    rawPayload: any,
    _headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    // Sandbox emails don't receive real webhooks — events are simulated
    throw new Error('Sandbox email adapter does not process real webhooks');
  }

  protected validateWebhookSignature(
    _payload: any,
    _headers: Record<string, string>
  ): boolean {
    return false;
  }
}
