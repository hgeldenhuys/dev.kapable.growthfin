/**
 * Kapable Channel Service SMS Adapter
 *
 * Routes SMS through the Kapable platform's unified channel API
 * instead of calling Twilio directly.
 */

import { BaseChannelAdapter } from '../base-adapter';
import type {
  OutboundMessage,
  SendResult,
  UnifiedWebhookEvent,
  SendSMSParams,
  SMSResult,
} from '../types';

export class KapableSMSAdapter extends BaseChannelAdapter {
  private channelUrl: string;
  private apiKey: string;
  private projectId: string;

  constructor() {
    super('sms', 'kapable');

    this.channelUrl = process.env.KAPABLE_CHANNEL_URL!;
    this.apiKey = process.env.KAPABLE_CHANNEL_KEY!;
    this.projectId = process.env.KAPABLE_PROJECT_ID!;
  }

  getSupportedEventTypes(): string[] {
    return ['sms.sent', 'sms.delivered', 'sms.failed'];
  }

  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const result = await this.send({
      to: message.to,
      message: message.content,
      workspaceId: message.workspaceId,
    });

    return {
      success: result.success,
      providerMessageId: result.messageId,
      cost: result.cost,
      metadata: { provider: 'kapable', segments: result.segments },
    };
  }

  async processWebhook(_payload: any): Promise<UnifiedWebhookEvent[]> {
    // Webhooks are handled by the Kapable platform
    return [];
  }

  async send(params: SendSMSParams): Promise<SMSResult> {
    try {
      const resp = await fetch(`${this.channelUrl}/v1/channels/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          project_id: this.projectId,
          to: params.to,
          body: params.message,
          from: params.from,
          metadata: params.metadata,
        }),
      });

      const data = await resp.json() as any;

      if (!data.success) {
        return {
          success: false,
          messageId: '',
          segments: 1,
          provider: 'twilio', // keep compatible with existing type
          error: {
            code: 'KAPABLE_CHANNEL_ERROR',
            message: data.error || 'Unknown channel error',
          },
        };
      }

      return {
        success: true,
        messageId: data.message_sid || data.channel_message_id || 'kapable',
        segments: 1,
        provider: 'twilio', // type compatibility
      };
    } catch (error: any) {
      this.log('error', `Kapable SMS send failed: ${error.message}`);
      return {
        success: false,
        messageId: '',
        segments: 0,
        provider: 'twilio',
        error: {
          code: 'KAPABLE_NETWORK_ERROR',
          message: error.message,
        },
      };
    }
  }

  async resolveFromNumber(_options: { from?: string; workspaceId?: string }): Promise<string> {
    // Kapable platform handles from-number resolution
    return _options.from || 'kapable-managed';
  }
}

// Singleton
let kapableSMSAdapter: KapableSMSAdapter | null = null;

export function getKapableSMSAdapter(): KapableSMSAdapter {
  if (!kapableSMSAdapter) {
    kapableSMSAdapter = new KapableSMSAdapter();
  }
  return kapableSMSAdapter;
}
