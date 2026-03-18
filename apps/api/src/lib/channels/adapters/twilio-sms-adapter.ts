/**
 * Twilio SMS Channel Adapter
 * Handles SMS sending and webhook processing via Twilio
 *
 * Supports workspace-level phone number configuration:
 * - Primary: Uses workspace.settings.twilio.defaultPhoneNumber
 * - Fallback: Uses TWILIO_PHONE_NUMBER env var
 * - Override: Explicit `from` parameter in send options
 */

import { BaseChannelAdapter } from '../base-adapter';
import type {
  OutboundMessage,
  SendResult,
  UnifiedWebhookEvent,
  SendSMSParams,
  SMSResult,
} from '../types';
import twilio from 'twilio';
import type { Twilio } from 'twilio';
import {
  getTestSessionManager,
  extractCorrelationId,
  stripCorrelationId,
  addCorrelationId,
} from '../test-session-manager';
import { validatePhoneNumber, resolveOutboundNumber } from '../../utils/phone-validation';
import { db, workspaces, type WorkspaceSettings } from '@agios/db';
import { eq } from 'drizzle-orm';

/**
 * TwilioSMSAdapter
 *
 * SMS channel adapter using Twilio as the provider
 */
export class TwilioSMSAdapter extends BaseChannelAdapter {
  private twilioClient: Twilio;
  private fromNumber: string;
  private testOutboundNumber: string;

  constructor() {
    super('sms', 'twilio');

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.testOutboundNumber = process.env.TWILIO_OUTBOUND_TEST_NUMBER || '';

    if (!accountSid || !authToken) {
      throw new Error(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required'
      );
    }

    if (!this.fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER environment variable is required');
    }

    this.twilioClient = twilio(accountSid, authToken);
  }

  /**
   * Resolve the 'from' phone number for sending SMS
   *
   * Resolution order:
   * 1. Explicit override (from parameter in options)
   * 2. Workspace settings (if workspaceId provided)
   * 3. Environment variable fallback (TWILIO_PHONE_NUMBER)
   *
   * @param options - Object containing optional from and workspaceId
   * @returns The resolved phone number in E.164 format
   */
  async resolveFromNumber(options: { from?: string; workspaceId?: string }): Promise<string> {
    // 1. Explicit override takes precedence
    if (options.from) {
      return options.from;
    }

    // 2. Try workspace settings
    if (options.workspaceId) {
      try {
        const workspace = await db
          .select({ settings: workspaces.settings })
          .from(workspaces)
          .where(eq(workspaces.id, options.workspaceId))
          .limit(1);

        if (workspace[0]?.settings) {
          const settings = workspace[0].settings as WorkspaceSettings;
          if (settings.twilio?.defaultPhoneNumber) {
            this.log('info', `Using workspace phone number for ${options.workspaceId}`, {
              phoneNumber: settings.twilio.defaultPhoneNumber,
            });
            return settings.twilio.defaultPhoneNumber;
          }
        }
      } catch (error) {
        this.log('warn', 'Failed to lookup workspace phone number, falling back to env var', error);
      }
    }

    // 3. Fallback to environment variable
    return this.fromNumber;
  }

  getSupportedEventTypes(): string[] {
    return ['sms.sent', 'sms.delivered', 'sms.failed', 'sms.received', 'sms.queued', 'sms.undelivered'];
  }

  /**
   * Send SMS via Twilio
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const smsOptions = message.channelOptions?.sms;

    // Resolve from number: explicit override → geo-match → workspace default → env var
    const from = await resolveOutboundNumber({
      recipientPhone: message.to,
      workspaceId: message.workspaceId,
      capability: 'sms',
      explicitFrom: smsOptions?.from,
    });

    // Determine actual recipient and content based on test mode
    let actualTo = message.to;
    let actualContent = message.content;
    let testSession = null;

    // TEST MODE: Create test session and use correlation ID
    if (message.testMode && this.testOutboundNumber) {
      if (!message.contactId) {
        throw new Error('contactId is required when testMode is enabled');
      }

      // Create test session
      const sessionManager = getTestSessionManager();
      const result = await sessionManager.createSession({
        workspaceId: message.workspaceId,
        testPhoneNumber: this.testOutboundNumber,
        contactId: message.contactId,
        contactPhone: message.to, // Store real contact's phone
        campaignId: message.campaignId,
        recipientId: message.recipientId,
      });

      testSession = result.session;
      const correlationId = result.correlationId;

      // Prepend correlation ID to message
      actualContent = addCorrelationId(correlationId, message.content);

      // Send to test number instead of real contact
      actualTo = this.testOutboundNumber;

      this.log('info', `Test mode enabled: sending to test number with correlation ${correlationId}`, {
        realRecipient: message.to,
        testRecipient: actualTo,
        correlationId,
      });
    }

    try {
      const twilioMessage = await this.twilioClient.messages.create({
        to: actualTo,
        from,
        body: actualContent,
        // Pass tracking data in statusCallback
        statusCallback: this.getStatusCallbackUrl(message),
      });

      this.log('info', `SMS sent successfully`, {
        messageSid: twilioMessage.sid,
        to: actualTo,
        testMode: message.testMode,
      });

      // Calculate cost (Twilio returns price as string like "-0.00750")
      const cost = twilioMessage.price
        ? Math.abs(parseFloat(twilioMessage.price) * 100)
        : undefined;

      return {
        success: true,
        messageId: twilioMessage.sid,
        channel: 'sms',
        metadata: {
          twilioSid: twilioMessage.sid,
          status: twilioMessage.status,
          from: twilioMessage.from,
          to: twilioMessage.to,
          segments: twilioMessage.numSegments,
          cost, // Added cost tracking
          testMode: message.testMode,
          correlationId: testSession?.correlationId,
          realContactPhone: message.testMode ? message.to : undefined,
        },
      };
    } catch (error) {
      this.log('error', 'Failed to send SMS', error);
      throw error;
    }
  }

  /**
   * Send SMS with full control over parameters
   *
   * This method provides direct access to SMS sending with explicit parameters,
   * useful for programmatic SMS sending outside of the campaign system.
   *
   * Phone number resolution order:
   * 1. Explicit `from` parameter
   * 2. Workspace settings (if workspaceId provided)
   * 3. TWILIO_PHONE_NUMBER env var fallback
   */
  async send(params: SendSMSParams): Promise<SMSResult> {
    try {
      // Validate phone number
      const phoneValidation = validatePhoneNumber(params.to);
      if (!phoneValidation.valid) {
        return {
          success: false,
          messageId: '',
          segments: 0,
          provider: 'twilio',
          error: {
            code: 'INVALID_PHONE',
            message: phoneValidation.error || 'Invalid phone number',
          },
        };
      }

      // Calculate segments before sending
      const segments = this.calculateSegments(params.message);

      // Resolve the sender phone number: explicit → geo-match → workspace default → env var
      const fromNumber = await resolveOutboundNumber({
        recipientPhone: params.to,
        workspaceId: params.workspaceId || '',
        capability: 'sms',
        explicitFrom: params.from,
      });

      this.log('info', `Sending SMS to ${params.to}`, {
        segments,
        length: params.message.length,
        from: fromNumber,
        workspaceId: params.workspaceId,
      });

      // Send via Twilio API
      const twilioMessage = await this.twilioClient.messages.create({
        to: phoneValidation.e164!,
        from: fromNumber,
        body: params.message,
        statusCallback: params.statusCallback,
      });

      // Calculate cost (Twilio returns price as string like "-0.00750")
      const cost = twilioMessage.price
        ? Math.abs(parseFloat(twilioMessage.price) * 100)
        : undefined;

      this.log('info', `SMS sent successfully`, {
        sid: twilioMessage.sid,
        segments: twilioMessage.numSegments || segments,
        cost,
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        segments: parseInt(twilioMessage.numSegments || '1', 10),
        cost,
        provider: 'twilio',
      };
    } catch (error: any) {
      this.log('error', 'SMS send failed', error);

      // Extract Twilio error details
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorMessage = error.message || 'SMS send failed';

      return {
        success: false,
        messageId: '',
        segments: 0,
        provider: 'twilio',
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Calculate SMS segments
   *
   * GSM-7 encoding:
   * - Single message: 160 characters
   * - Multi-part: 153 characters per segment
   *
   * Unicode encoding (if non-ASCII characters present):
   * - Single message: 70 characters
   * - Multi-part: 67 characters per segment
   */
  private calculateSegments(message: string): number {
    const length = message.length;

    if (length === 0) return 0;

    // Detect if Unicode is needed (non-ASCII characters)
    const isUnicode = /[^\x00-\x7F]/.test(message);

    if (isUnicode) {
      // Unicode encoding
      if (length <= 70) return 1;
      return Math.ceil(length / 67);
    } else {
      // GSM-7 encoding
      if (length <= 160) return 1;
      return Math.ceil(length / 153);
    }
  }

  /**
   * Transform Twilio webhook to unified format
   */
  protected async transformWebhook(
    rawPayload: any,
    headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    /*
     * Twilio sends webhooks in two scenarios:
     * 1. Status callbacks (for outbound messages)
     * 2. Incoming messages (inbound)
     *
     * Status callback fields:
     * - MessageSid, MessageStatus, To, From, Body, etc.
     *
     * Incoming message fields:
     * - MessageSid, From, To, Body, NumMedia, etc.
     */

    const messageSid = rawPayload.MessageSid || rawPayload.SmsSid;
    const messageStatus = rawPayload.MessageStatus || rawPayload.SmsStatus;
    let from = rawPayload.From;
    const to = rawPayload.To;
    let body = rawPayload.Body;
    const errorCode = rawPayload.ErrorCode;

    // Determine if this is inbound or outbound
    const isInbound = !messageStatus; // Inbound messages don't have MessageStatus
    const direction: 'inbound' | 'outbound' = isInbound ? 'inbound' : 'outbound';

    // Extract tracking data from custom parameters (if available)
    let campaignId = rawPayload.CampaignId;
    let recipientId = rawPayload.RecipientId;
    let contactId = rawPayload.ContactId;
    let workspaceId = rawPayload.WorkspaceId;

    // TEST MODE: Handle correlation IDs for inbound messages
    if (isInbound && body) {
      const correlationId = extractCorrelationId(body);

      if (correlationId) {
        this.log('info', `Correlation ID detected: ${correlationId}`, {
          originalFrom: from,
        });

        // Look up test session
        const sessionManager = getTestSessionManager();
        const session = await sessionManager.lookupByCorrelation(correlationId);

        if (session) {
          this.log('info', `Test session found for correlation ${correlationId}`, {
            contactId: session.contactId,
            realPhone: session.contactPhone,
          });

          // Map test number to real contact
          from = session.contactPhone;
          contactId = session.contactId;
          workspaceId = session.workspaceId;
          campaignId = session.campaignId || campaignId;
          recipientId = session.recipientId || recipientId;

          // Strip correlation ID from content
          body = stripCorrelationId(body);

          // Record inbound activity
          await sessionManager.recordInbound(session.id);

          this.log('info', `Mapped test message to real contact`, {
            correlationId,
            contactId,
            contactPhone: from,
          });
        } else {
          this.log('warn', `No test session found for correlation ${correlationId}`);
        }
      }
    }

    // Map Twilio status to our event type (with sms. prefix for consistency)
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
      eventType = statusMap[messageStatus.toLowerCase()] || 'sms.unknown';
    }

    // Build unified event (matching Voice/WhatsApp structure)
    const unifiedEvent: UnifiedWebhookEvent = {
      eventId: `${messageSid}-${Date.now()}`,
      eventType,
      occurredAt: new Date(),
      channel: 'sms',
      vendor: 'twilio',
      direction,
      recipient: {
        to,
        from,
      },
      vendorMessageId: messageSid, // Changed from vendorEventId for consistency
      status: messageStatus || 'received',
      content: body,
      metadata: {
        messageSid,
        segments: parseInt(rawPayload.NumSegments || '1', 10),
        carrierStatus: messageStatus,
        errorCode,
        // Tracking data moved to metadata (matching Voice/WhatsApp pattern)
        recipientId,
        contactId,
        campaignId,
        workspaceId: workspaceId || '',
      },
      rawPayload,
    };

    return unifiedEvent;
  }

  /**
   * Validate Twilio webhook signature
   *
   * Twilio signs all webhooks using X-Twilio-Signature header with HMAC-SHA1
   * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
   */
  protected validateWebhookSignature(
    payload: any,
    headers: Record<string, string>,
    rawBody?: string
  ): boolean {
    const signature = headers['x-twilio-signature'] || headers['X-Twilio-Signature'];

    // Stricter: require signature header always
    if (!signature) {
      this.log('warn', 'Missing Twilio signature header');

      // Only allow in development mode
      if (process.env.NODE_ENV === 'development') {
        this.log('warn', 'Allowing unsigned webhook in development mode');
        return true;
      }

      return false;
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL;

    if (!authToken) {
      this.log('warn', 'TWILIO_AUTH_TOKEN not set, skipping signature validation');

      // Only allow in development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }

      return false;
    }

    // In development, accept any signature
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    try {
      // Validate using Twilio's validateRequest method
      if (!webhookUrl) {
        this.log('error', 'TWILIO_WEBHOOK_URL not configured for production');
        return false;
      }

      const isValid = twilio.validateRequest(
        authToken,
        signature,
        webhookUrl,
        payload
      );

      if (!isValid) {
        this.log('error', 'Invalid Twilio signature');
        return false;
      }

      return true;
    } catch (error) {
      this.log('error', 'Signature validation error', error);
      return false;
    }
  }

  /**
   * Get status callback URL for Twilio
   * This URL will be called with status updates
   * @private
   */
  private getStatusCallbackUrl(message: OutboundMessage): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const webhookPath = this.getWebhookPath();

    // Encode tracking data as query parameters
    const params = new URLSearchParams({
      CampaignId: message.campaignId || '',
      RecipientId: message.recipientId || '',
      ContactId: message.contactId || '',
      WorkspaceId: message.workspaceId,
    });

    return `${baseUrl}/api/v1/crm/webhooks/${webhookPath}?${params.toString()}`;
  }
}

/**
 * Get or create singleton Twilio SMS adapter
 */
let twilioSMSAdapter: TwilioSMSAdapter | null = null;

export function getTwilioSMSAdapter(): TwilioSMSAdapter {
  if (!twilioSMSAdapter) {
    twilioSMSAdapter = new TwilioSMSAdapter();
  }
  return twilioSMSAdapter;
}
