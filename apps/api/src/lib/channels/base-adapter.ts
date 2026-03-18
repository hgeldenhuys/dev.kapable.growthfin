/**
 * Base Channel Adapter
 * Abstract base class for all channel adapters
 */

import { randomUUID } from 'crypto';
import type {
  ChannelAdapter,
  ChannelType,
  OutboundMessage,
  SendResult,
  UnifiedWebhookEvent,
  WebhookValidationResult,
} from './types';

/**
 * BaseChannelAdapter
 *
 * Provides common functionality for all channel adapters.
 * Subclasses must implement:
 * - sendMessage()
 * - transformWebhook()
 * - validateWebhookSignature()
 */
export abstract class BaseChannelAdapter implements ChannelAdapter {
  protected channelType: ChannelType;
  protected vendorName: string;

  constructor(channelType: ChannelType, vendorName: string) {
    this.channelType = channelType;
    this.vendorName = vendorName;
  }

  // ========== Public Interface ==========

  getChannelType(): ChannelType {
    return this.channelType;
  }

  getVendorName(): string {
    return this.vendorName;
  }

  abstract getSupportedEventTypes(): string[];

  /**
   * Send a message through this channel
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    try {
      console.log(`[${this.vendorName}] Sending ${this.channelType} message to ${message.to}`);

      // Call subclass implementation
      const result = await this.sendMessage(message);

      console.log(`[${this.vendorName}] Message sent successfully:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`[${this.vendorName}] Send failed:`, error);
      return {
        success: false,
        messageId: '',
        channel: this.channelType,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    rawPayload: any,
    headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    console.log(`[${this.vendorName}] Processing webhook:`, {
      channel: this.channelType,
      payloadKeys: Object.keys(rawPayload),
    });

    try {
      // Transform vendor-specific format to unified DSL
      const unifiedEvent = await this.transformWebhook(rawPayload, headers);

      // Generate our internal event ID
      unifiedEvent.eventId = randomUUID();

      // Ensure channel and vendor are set
      unifiedEvent.channel = this.channelType;

      console.log(`[${this.vendorName}] Webhook transformed:`, {
        eventId: unifiedEvent.eventId,
        eventType: unifiedEvent.eventType,
        direction: unifiedEvent.direction,
      });

      return unifiedEvent;
    } catch (error) {
      console.error(`[${this.vendorName}] Webhook transformation failed:`, error);
      throw error;
    }
  }

  /**
   * Validate webhook authenticity
   */
  validateWebhook(payload: any, headers: Record<string, string>): WebhookValidationResult {
    try {
      const isValid = this.validateWebhookSignature(payload, headers);
      return {
        valid: isValid,
        vendorName: this.vendorName,
      };
    } catch (error) {
      console.error(`[${this.vendorName}] Webhook validation failed:`, error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        vendorName: this.vendorName,
      };
    }
  }

  /**
   * Get webhook endpoint path
   */
  getWebhookPath(): string {
    return `${this.vendorName}-${this.channelType}`;
  }

  // ========== Abstract Methods (Subclasses Must Implement) ==========

  /**
   * Send message using vendor API
   * @protected
   */
  protected abstract sendMessage(message: OutboundMessage): Promise<SendResult>;

  /**
   * Transform vendor webhook to unified format
   * @protected
   */
  protected abstract transformWebhook(
    rawPayload: any,
    headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent>;

  /**
   * Validate webhook signature using vendor-specific method
   * @protected
   */
  protected abstract validateWebhookSignature(
    payload: any,
    headers: Record<string, string>
  ): boolean;

  // ========== Helper Methods ==========

  /**
   * Extract workspace ID from campaign/recipient IDs
   * Subclasses can override for custom logic
   * @protected
   */
  protected async extractWorkspaceId(
    campaignId?: string,
    recipientId?: string
  ): Promise<string | undefined> {
    // Default: Look up from database if needed
    // For now, return undefined - will be populated by webhook processor
    return undefined;
  }

  /**
   * Extract contact ID from recipient ID
   * @protected
   */
  protected async extractContactId(recipientId?: string): Promise<string | undefined> {
    // Default: Look up from database if needed
    return undefined;
  }

  /**
   * Log adapter activity
   * @protected
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const prefix = `[${this.vendorName}/${this.channelType}]`;
    switch (level) {
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }
}
