/**
 * Channel Adapter Types
 * Core types for multi-channel communication system
 */

// ============================================================================
// CHANNEL TYPES
// ============================================================================

export type ChannelType = 'email' | 'sms' | 'voice' | 'ai_voice' | 'whatsapp' | 'telegram';

export type EventDirection = 'inbound' | 'outbound';

// ============================================================================
// UNIFIED WEBHOOK DSL v1.0
// ============================================================================

/**
 * Unified Webhook Event
 *
 * This is the normalized format that all vendor webhooks are transformed into.
 * Channel adapters convert vendor-specific formats to this DSL.
 */
export interface UnifiedWebhookEvent {
  // ========== Identity ==========
  eventId: string;              // Our internal event ID (UUID)
  vendorEventId: string;        // Vendor's event/message ID (Twilio SID, Resend ID, etc.)

  // ========== Classification ==========
  channel: ChannelType;         // Which channel (sms, email, voice, etc.)
  eventType: string;            // Generic event type (sent, delivered, received, completed, etc.)
  direction: EventDirection;    // inbound (from contact) or outbound (to contact)

  // ========== Participants ==========
  from: string;                 // Sender (phone, email, whatsapp ID)
  to: string;                   // Recipient (phone, email, whatsapp ID)

  // ========== Content ==========
  content?: string;             // Message body (for inbound messages or outbound copy)
  subject?: string;             // Email subject or call title
  metadata?: Record<string, any>; // Channel-specific data

  // ========== Tracking ==========
  campaignId?: string;          // Campaign ID (if part of campaign)
  recipientId?: string;         // Campaign recipient ID (if tied to campaign)
  contactId?: string;           // Contact ID in CRM
  leadId?: string;              // Lead ID in CRM
  workspaceId: string;          // Workspace isolation

  // ========== Timing ==========
  occurredAt: Date;             // When the event happened (vendor timestamp)

  // ========== Channel-Specific Extensions ==========

  /** SMS-specific data */
  sms?: {
    segments?: number;          // Number of SMS segments
    carrierStatus?: string;     // Carrier delivery status
    errorCode?: string;         // Error code if failed
  };

  /** Voice call data */
  voice?: {
    duration?: number;          // Call duration in seconds
    recordingUrl?: string;      // URL to call recording
    transcription?: string;     // Call transcription
    dialStatus?: string;        // completed, no-answer, busy, failed
  };

  /** WhatsApp data */
  whatsapp?: {
    messageId?: string;         // WhatsApp message ID
    read?: boolean;             // Read receipt
    templateName?: string;      // Template name if using template
  };

  /** Email data */
  email?: {
    bounceType?: 'hard_bounce' | 'soft_bounce' | 'spam_complaint';
    bounceDescription?: string;
    linkUrl?: string;           // For click events
  };
}

// ============================================================================
// OUTBOUND MESSAGE TYPES
// ============================================================================

/**
 * Base outbound message interface
 * Used when sending messages through channel adapters
 */
export interface OutboundMessage {
  // Recipient
  to: string;                   // Phone, email, whatsapp ID

  // Content
  content: string;              // Message body
  subject?: string;             // Email subject (optional for SMS/WhatsApp)

  // Tracking (for campaign integration)
  campaignId?: string;
  recipientId?: string;
  contactId?: string;
  leadId?: string;
  workspaceId: string;
  channel?: 'sms' | 'email' | 'voice' | 'ai_voice' | 'whatsapp';

  // Test mode (for safe testing with real APIs)
  testMode?: boolean;           // If true, use test numbers/correlation IDs

  // Channel-specific options
  channelOptions?: {
    // SMS
    sms?: {
      from?: string;            // Sender phone number or alphanumeric ID
    };

    // Email
    email?: {
      from?: string;            // Sender email
      fromName?: string;        // Sender name
      replyTo?: string;         // Reply-to email
      html?: string;            // HTML version
    };

    // Voice
    voice?: {
      from?: string;            // Caller ID
      voiceUrl?: string;        // TwiML or voice script URL
      recordCall?: boolean;
    };

    // WhatsApp
    whatsapp?: {
      templateName?: string;    // WhatsApp approved template
      templateParams?: string[];
    };
  };
}

/**
 * Send result from channel adapter
 */
export interface SendResult {
  success: boolean;
  messageId: string;            // Vendor's message/email/SID
  channel: ChannelType;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// WEBHOOK VALIDATION
// ============================================================================

/**
 * Webhook validation result
 */
export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
  vendorName?: string;
}

// ============================================================================
// CHANNEL ADAPTER INTERFACE
// ============================================================================

/**
 * Channel Adapter Interface
 *
 * All channel adapters (Twilio SMS, Resend Email, etc.) must implement this.
 */
export interface ChannelAdapter {
  /**
   * Get the channel type this adapter handles
   */
  getChannelType(): ChannelType;

  /**
   * Get the vendor name (e.g., 'twilio', 'resend', 'telnyx')
   */
  getVendorName(): string;

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): string[];

  /**
   * Send an outbound message
   */
  send(message: OutboundMessage): Promise<SendResult>;

  /**
   * Process incoming webhook and convert to unified format
   */
  processWebhook(rawPayload: any, headers?: Record<string, string>): Promise<UnifiedWebhookEvent>;

  /**
   * Validate webhook signature/authenticity
   */
  validateWebhook(payload: any, headers: Record<string, string>): WebhookValidationResult;

  /**
   * Get webhook endpoint path (relative to /api/v1/crm/webhooks/)
   */
  getWebhookPath(): string;
}

// ============================================================================
// TIMELINE EVENT MAPPING
// ============================================================================

/**
 * Maps unified webhook events to timeline event types
 */
export interface TimelineEventMapping {
  channel: ChannelType;
  eventType: string;            // From UnifiedWebhookEvent.eventType
  timelineEventType: string;    // For crmTimelineEvents.eventType
  eventCategory: 'communication' | 'milestone' | 'data' | 'system' | 'compliance';
  eventLabel: string;           // Human-readable label
}

/**
 * Standard timeline event mappings
 */
export const TIMELINE_EVENT_MAPPINGS: TimelineEventMapping[] = [
  // Email
  { channel: 'email', eventType: 'sent', timelineEventType: 'campaign.email_sent', eventCategory: 'communication', eventLabel: 'Email Sent' },
  { channel: 'email', eventType: 'delivered', timelineEventType: 'campaign.email_delivered', eventCategory: 'communication', eventLabel: 'Email Delivered' },
  { channel: 'email', eventType: 'opened', timelineEventType: 'campaign.email_opened', eventCategory: 'communication', eventLabel: 'Email Opened' },
  { channel: 'email', eventType: 'clicked', timelineEventType: 'campaign.email_clicked', eventCategory: 'communication', eventLabel: 'Email Link Clicked' },
  { channel: 'email', eventType: 'bounced', timelineEventType: 'campaign.email_bounced', eventCategory: 'communication', eventLabel: 'Email Bounced' },

  // SMS
  { channel: 'sms', eventType: 'sent', timelineEventType: 'campaign.sms_sent', eventCategory: 'communication', eventLabel: 'SMS Sent' },
  { channel: 'sms', eventType: 'delivered', timelineEventType: 'campaign.sms_delivered', eventCategory: 'communication', eventLabel: 'SMS Delivered' },
  { channel: 'sms', eventType: 'failed', timelineEventType: 'campaign.sms_failed', eventCategory: 'communication', eventLabel: 'SMS Failed' },
  { channel: 'sms', eventType: 'received', timelineEventType: 'campaign.sms_received', eventCategory: 'communication', eventLabel: 'SMS Received' },

  // Voice
  { channel: 'voice', eventType: 'initiated', timelineEventType: 'campaign.voice_initiated', eventCategory: 'communication', eventLabel: 'Voice Call Initiated' },
  { channel: 'voice', eventType: 'ringing', timelineEventType: 'campaign.voice_ringing', eventCategory: 'communication', eventLabel: 'Phone Ringing' },
  { channel: 'voice', eventType: 'answered', timelineEventType: 'campaign.voice_answered', eventCategory: 'communication', eventLabel: 'Call Answered' },
  { channel: 'voice', eventType: 'completed', timelineEventType: 'campaign.voice_completed', eventCategory: 'communication', eventLabel: 'Call Completed' },
  { channel: 'voice', eventType: 'no_answer', timelineEventType: 'campaign.voice_no_answer', eventCategory: 'communication', eventLabel: 'No Answer' },
  { channel: 'voice', eventType: 'busy', timelineEventType: 'campaign.voice_busy', eventCategory: 'communication', eventLabel: 'Line Busy' },
  { channel: 'voice', eventType: 'failed', timelineEventType: 'campaign.voice_failed', eventCategory: 'communication', eventLabel: 'Call Failed' },

  // AI Voice
  { channel: 'ai_voice', eventType: 'initiated', timelineEventType: 'campaign.ai_voice_initiated', eventCategory: 'communication', eventLabel: 'AI Voice Call Initiated' },
  { channel: 'ai_voice', eventType: 'completed', timelineEventType: 'campaign.ai_voice_completed', eventCategory: 'communication', eventLabel: 'AI Voice Call Completed' },
  { channel: 'ai_voice', eventType: 'transcript_available', timelineEventType: 'campaign.ai_voice_transcript', eventCategory: 'communication', eventLabel: 'AI Voice Transcript Ready' },

  // WhatsApp
  { channel: 'whatsapp', eventType: 'sent', timelineEventType: 'campaign.whatsapp_sent', eventCategory: 'communication', eventLabel: 'WhatsApp Sent' },
  { channel: 'whatsapp', eventType: 'delivered', timelineEventType: 'campaign.whatsapp_delivered', eventCategory: 'communication', eventLabel: 'WhatsApp Delivered' },
  { channel: 'whatsapp', eventType: 'read', timelineEventType: 'campaign.whatsapp_read', eventCategory: 'communication', eventLabel: 'WhatsApp Read' },
  { channel: 'whatsapp', eventType: 'received', timelineEventType: 'campaign.whatsapp_received', eventCategory: 'communication', eventLabel: 'WhatsApp Received' },
  { channel: 'whatsapp', eventType: 'failed', timelineEventType: 'campaign.whatsapp_failed', eventCategory: 'communication', eventLabel: 'WhatsApp Failed' },

  // Telegram
  { channel: 'telegram', eventType: 'sent', timelineEventType: 'campaign.telegram_sent', eventCategory: 'communication', eventLabel: 'Telegram Sent' },
  { channel: 'telegram', eventType: 'delivered', timelineEventType: 'campaign.telegram_delivered', eventCategory: 'communication', eventLabel: 'Telegram Delivered' },
  { channel: 'telegram', eventType: 'received', timelineEventType: 'campaign.telegram_received', eventCategory: 'communication', eventLabel: 'Telegram Received' },
];

/**
 * Get timeline event mapping for a channel + event type
 */
export function getTimelineEventMapping(
  channel: ChannelType,
  eventType: string
): TimelineEventMapping | undefined {
  return TIMELINE_EVENT_MAPPINGS.find(
    (m) => m.channel === channel && m.eventType === eventType
  );
}

// ============================================================================
// SMS-SPECIFIC TYPES
// ============================================================================

/**
 * SMS Send Parameters
 */
export interface SendSMSParams {
  to: string;              // E.164 format
  message: string;         // Message body
  from?: string;           // Optional override (takes precedence)
  workspaceId?: string;    // Workspace for phone number lookup
  statusCallback?: string; // Webhook URL
  metadata?: Record<string, string>;
}

/**
 * SMS Result
 */
export interface SMSResult {
  success: boolean;
  messageId: string;       // Twilio SID
  segments: number;
  cost?: number;           // USD cents
  provider: 'twilio';
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Twilio Configuration
 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookSecret: string;
}
