/**
 * Twilio WhatsApp Channel Adapter
 * Handles WhatsApp messages and webhook processing via Twilio
 */

import { BaseChannelAdapter } from '../base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import { Twilio } from 'twilio';

/**
 * TwilioWhatsAppAdapter
 *
 * WhatsApp channel adapter using Twilio as the provider
 * Note: WhatsApp numbers must be prefixed with 'whatsapp:'
 */
export class TwilioWhatsAppAdapter extends BaseChannelAdapter {
  private twilioClient: Twilio;
  private fromNumber: string;

  constructor() {
    super('whatsapp', 'twilio');

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken) {
      throw new Error(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required'
      );
    }

    if (!this.fromNumber) {
      throw new Error(
        'TWILIO_WHATSAPP_NUMBER or TWILIO_PHONE_NUMBER environment variable is required'
      );
    }

    this.twilioClient = new Twilio(accountSid, authToken);
  }

  getSupportedEventTypes(): string[] {
    return ['sent', 'delivered', 'read', 'failed', 'received', 'queued', 'undelivered'];
  }

  /**
   * Send WhatsApp message via Twilio
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const whatsappOptions = message.channelOptions?.whatsapp;
    const from = this.formatWhatsAppNumber(whatsappOptions?.from || this.fromNumber);
    const to = this.formatWhatsAppNumber(message.to);

    try {
      const twilioMessage = await this.twilioClient.messages.create({
        to,
        from,
        body: message.content,
        statusCallback: this.getStatusCallbackUrl(message),
        // WhatsApp-specific options
        ...(whatsappOptions?.mediaUrl && { mediaUrl: [whatsappOptions.mediaUrl] }),
        ...(whatsappOptions?.persistentAction && {
          persistentAction: whatsappOptions.persistentAction,
        }),
      });

      this.log('info', 'WhatsApp message sent', {
        messageSid: twilioMessage.sid,
        to: message.to,
        from,
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        vendorResponse: twilioMessage,
      };
    } catch (error) {
      this.log('error', 'Failed to send WhatsApp message', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transform Twilio WhatsApp webhook to unified format
   */
  protected async transformWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    const messageSid = payload.MessageSid || payload.SmsSid;
    const messageStatus = payload.MessageStatus || payload.SmsStatus;
    const from = this.stripWhatsAppPrefix(payload.From);
    const to = this.stripWhatsAppPrefix(payload.To);
    const body = payload.Body;
    const numMedia = payload.NumMedia ? parseInt(payload.NumMedia, 10) : 0;
    const errorCode = payload.ErrorCode;
    const errorMessage = payload.ErrorMessage;

    // Extract tracking data
    const recipientId = payload.RecipientId;
    const contactId = payload.ContactId;
    const campaignId = payload.CampaignId;
    const workspaceId = payload.WorkspaceId;

    // Determine if this is an inbound message
    const isInbound = !recipientId && !!body;

    // Map Twilio status to unified event type
    let eventType: string;
    if (isInbound) {
      eventType = 'whatsapp.received';
    } else {
      switch (messageStatus) {
        case 'queued':
        case 'sending':
        case 'sent':
          eventType = 'whatsapp.sent';
          break;
        case 'delivered':
          eventType = 'whatsapp.delivered';
          break;
        case 'read':
          eventType = 'whatsapp.read';
          break;
        case 'failed':
        case 'undelivered':
          eventType = 'whatsapp.failed';
          break;
        default:
          eventType = 'whatsapp.unknown';
      }
    }

    this.log('info', 'Processing WhatsApp webhook', {
      messageSid,
      messageStatus,
      eventType,
      isInbound,
    });

    // Build media URLs if present
    const mediaUrls: string[] = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = payload[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
        }
      }
    }

    return {
      eventId: `${messageSid}-${Date.now()}`,
      eventType,
      occurredAt: new Date(),
      channel: 'whatsapp',
      vendor: 'twilio',
      direction: isInbound ? 'inbound' : 'outbound',
      recipient: {
        to,
        from,
      },
      content: body,
      vendorMessageId: messageSid,
      status: messageStatus,
      metadata: {
        messageSid,
        numMedia,
        mediaUrls,
        errorCode,
        errorMessage,
        // Tracking data
        recipientId,
        contactId,
        campaignId,
        workspaceId,
      },
      rawPayload: payload,
    };
  }

  /**
   * Validate Twilio webhook signature
   */
  validateWebhookSignature(
    payload: any,
    headers: Record<string, string>,
    rawBody?: string
  ): boolean {
    const signature = headers['x-twilio-signature'];
    if (!signature) {
      this.log('warn', 'Missing Twilio signature header');
      return false;
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      this.log('warn', 'TWILIO_AUTH_TOKEN not set, skipping signature validation');
      return true; // Allow in development
    }

    try {
      const webhookUrl = this.getWebhookUrl();
      const isValid = this.twilioClient.validateRequest(authToken, signature, webhookUrl, payload);

      if (!isValid) {
        this.log('warn', 'Invalid Twilio webhook signature');
      }

      return isValid;
    } catch (error) {
      this.log('error', 'Error validating Twilio signature', { error });
      return false;
    }
  }

  /**
   * Format phone number with whatsapp: prefix
   */
  private formatWhatsAppNumber(phoneNumber: string): string {
    if (phoneNumber.startsWith('whatsapp:')) {
      return phoneNumber;
    }
    return `whatsapp:${phoneNumber}`;
  }

  /**
   * Strip whatsapp: prefix from phone number
   */
  private stripWhatsAppPrefix(phoneNumber: string): string {
    if (phoneNumber.startsWith('whatsapp:')) {
      return phoneNumber.substring(9);
    }
    return phoneNumber;
  }

  /**
   * Get status callback URL for message tracking
   */
  private getStatusCallbackUrl(message: OutboundMessage): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const webhookPath = this.getWebhookPath();

    // Encode tracking data as query parameters
    const params = new URLSearchParams({
      RecipientId: message.recipientId || '',
      ContactId: message.contactId || '',
      CampaignId: message.campaignId || '',
      WorkspaceId: message.workspaceId,
    });

    return `${baseUrl}/api/v1/crm/webhooks/${webhookPath}?${params.toString()}`;
  }

  /**
   * Get webhook URL for signature validation
   */
  private getWebhookUrl(): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/crm/webhooks/${this.getWebhookPath()}`;
  }
}

/**
 * Singleton instance
 */
let twilioWhatsAppAdapterInstance: TwilioWhatsAppAdapter | null = null;

/**
 * Get or create TwilioWhatsAppAdapter instance
 */
export function getTwilioWhatsAppAdapter(): TwilioWhatsAppAdapter {
  if (!twilioWhatsAppAdapterInstance) {
    twilioWhatsAppAdapterInstance = new TwilioWhatsAppAdapter();
  }
  return twilioWhatsAppAdapterInstance;
}
