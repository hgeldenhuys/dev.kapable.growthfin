/**
 * Twilio Voice Channel Adapter
 * Handles voice calls and webhook processing via Twilio
 */

import { BaseChannelAdapter } from '../base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import { Twilio } from 'twilio';
import { resolveOutboundNumber } from '../../utils/phone-validation';

/**
 * TwilioVoiceAdapter
 *
 * Voice channel adapter using Twilio as the provider
 */
export class TwilioVoiceAdapter extends BaseChannelAdapter {
  private twilioClient: Twilio;
  private fromNumber: string;

  constructor() {
    super('voice', 'twilio');

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken) {
      throw new Error(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required'
      );
    }

    if (!this.fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER environment variable is required');
    }

    this.twilioClient = new Twilio(accountSid, authToken);
  }

  getSupportedEventTypes(): string[] {
    return [
      'initiated',
      'ringing',
      'in-progress',
      'answered',
      'completed',
      'busy',
      'no-answer',
      'failed',
      'canceled',
    ];
  }

  /**
   * Initiate voice call via Twilio
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const voiceOptions = message.channelOptions?.voice;
    const from = await resolveOutboundNumber({
      recipientPhone: message.to,
      workspaceId: message.workspaceId,
      capability: 'voice',
      explicitFrom: voiceOptions?.from,
    });

    // Voice calls need a TwiML URL or instructions
    const twimlUrl = voiceOptions?.twimlUrl || this.getDefaultTwimlUrl(message);

    try {
      const call = await this.twilioClient.calls.create({
        to: message.to,
        from,
        url: twimlUrl,
        statusCallback: this.getStatusCallbackUrl(message),
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        // Optional parameters
        ...(voiceOptions?.timeout && { timeout: voiceOptions.timeout }),
        ...(voiceOptions?.machineDetection && {
          machineDetection: voiceOptions.machineDetection,
        }),
      });

      this.log('info', 'Voice call initiated', {
        callSid: call.sid,
        to: message.to,
        from,
      });

      return {
        success: true,
        messageId: call.sid,
        vendorResponse: call,
      };
    } catch (error) {
      this.log('error', 'Failed to initiate voice call', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transform Twilio voice webhook to unified format
   *
   * Note: For browser-initiated calls (VOICE-001), tracking data like workspaceId,
   * leadId, and userId are passed via query parameters on the status callback URL.
   * The webhook handler merges these into the payload before calling this method.
   */
  protected async transformWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    // Twilio sends voice webhooks as form-encoded data
    const callSid = payload.CallSid || payload.ParentCallSid;
    const callStatus = payload.CallStatus;
    const from = payload.From;
    const to = payload.To;
    const direction = payload.Direction; // 'inbound' or 'outbound'
    const duration = payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined;
    const errorCode = payload.ErrorCode;
    const errorMessage = payload.ErrorMessage;

    // Extract tracking data (may come from form body or merged query params)
    const recipientId = payload.RecipientId;
    const contactId = payload.ContactId;
    const campaignId = payload.CampaignId;
    const workspaceId = payload.WorkspaceId || payload.workspaceId;
    const leadId = payload.LeadId || payload.leadId;
    const userId = payload.UserId || payload.userId;

    // Map Twilio call status to unified event type
    let eventType: string;
    switch (callStatus) {
      case 'queued':
      case 'initiated':
        eventType = 'voice.initiated';
        break;
      case 'ringing':
        eventType = 'voice.ringing';
        break;
      case 'in-progress':
        eventType = 'voice.answered';
        break;
      case 'completed':
        eventType = 'voice.completed';
        break;
      case 'busy':
        eventType = 'voice.busy';
        break;
      case 'no-answer':
        eventType = 'voice.no_answer';
        break;
      case 'failed':
        eventType = 'voice.failed';
        break;
      case 'canceled':
        eventType = 'voice.canceled';
        break;
      default:
        eventType = 'voice.unknown';
    }

    this.log('info', 'Processing voice webhook', {
      callSid,
      callStatus,
      eventType,
      direction,
      leadId,
      workspaceId,
    });

    return {
      eventId: `${callSid}-${Date.now()}`,
      eventType,
      occurredAt: new Date(),
      channel: 'voice',
      vendor: 'twilio',
      direction: direction === 'inbound' ? 'inbound' : 'outbound',
      recipient: {
        to,
        from,
      },
      vendorMessageId: callSid,
      status: callStatus,
      metadata: {
        callSid,
        duration,
        direction,
        errorCode,
        errorMessage,
        // Tracking data
        recipientId,
        contactId,
        campaignId,
        workspaceId,
        leadId,
        userId,
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
   * Get status callback URL for call tracking
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
   * Get default TwiML URL for voice calls
   * This returns a simple TwiML that plays the message content
   */
  private getDefaultTwimlUrl(message: OutboundMessage): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    // Encode message content as query parameter
    const params = new URLSearchParams({
      content: message.content,
      workspaceId: message.workspaceId,
    });
    return `${baseUrl}/api/v1/crm/twiml/voice?${params.toString()}`;
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
let twilioVoiceAdapterInstance: TwilioVoiceAdapter | null = null;

/**
 * Get or create TwilioVoiceAdapter instance
 */
export function getTwilioVoiceAdapter(): TwilioVoiceAdapter {
  if (!twilioVoiceAdapterInstance) {
    twilioVoiceAdapterInstance = new TwilioVoiceAdapter();
  }
  return twilioVoiceAdapterInstance;
}
