/**
 * Webhook Router
 * Central router that dispatches webhooks to appropriate channel adapters
 */

import type { ChannelAdapter, UnifiedWebhookEvent, WebhookValidationResult } from './types';
import { db } from '@agios/db';
import { crmCampaignRecipients, crmCampaigns } from '@agios/db';
import { eq, sql } from 'drizzle-orm';
import { timelineService } from '../../modules/crm/services/timeline';
import { getTimelineEventMapping } from './types';

/**
 * WebhookRouter
 *
 * Singleton that manages all channel adapters and routes incoming webhooks
 */
export class WebhookRouter {
  private adapters: Map<string, ChannelAdapter> = new Map();

  /**
   * Register a channel adapter
   */
  register(adapter: ChannelAdapter): void {
    const path = adapter.getWebhookPath();
    this.adapters.set(path, adapter);
    console.log(`[WebhookRouter] Registered adapter: ${path} (${adapter.getVendorName()} ${adapter.getChannelType()})`);
  }

  /**
   * Get adapter by webhook path
   */
  getAdapter(webhookPath: string): ChannelAdapter | undefined {
    return this.adapters.get(webhookPath);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Process incoming webhook
   *
   * @param webhookPath - The webhook path (e.g., 'resend-email', 'twilio-sms')
   * @param payload - Raw webhook payload
   * @param headers - HTTP headers
   */
  async processWebhook(
    webhookPath: string,
    payload: any,
    headers: Record<string, string>
  ): Promise<{ success: boolean; event?: UnifiedWebhookEvent; error?: string }> {
    console.log(`[WebhookRouter] Processing webhook: ${webhookPath}`);

    // Find adapter
    const adapter = this.getAdapter(webhookPath);
    if (!adapter) {
      console.error(`[WebhookRouter] No adapter found for path: ${webhookPath}`);
      return {
        success: false,
        error: `No adapter registered for webhook path: ${webhookPath}`,
      };
    }

    // Validate webhook
    const validation = adapter.validateWebhook(payload, headers);
    if (!validation.valid) {
      console.error(`[WebhookRouter] Webhook validation failed:`, validation.error);
      return {
        success: false,
        error: `Webhook validation failed: ${validation.error}`,
      };
    }

    try {
      // Transform to unified format
      const unifiedEvent = await adapter.processWebhook(payload, headers);

      // Process the unified event
      await this.handleUnifiedEvent(unifiedEvent);

      return {
        success: true,
        event: unifiedEvent,
      };
    } catch (error) {
      console.error(`[WebhookRouter] Error processing webhook:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Inject a unified event directly into the pipeline.
   * Used by the sandbox service to simulate webhook events
   * (delivery, open, click, bounce, reply) without going through
   * vendor adapters or signature validation.
   */
  async injectEvent(event: UnifiedWebhookEvent): Promise<void> {
    console.log(`[WebhookRouter] Injecting event:`, {
      channel: event.channel,
      eventType: event.eventType,
      direction: event.direction,
    });
    await this.handleUnifiedEvent(event);
  }

  /**
   * Handle a unified webhook event
   *
   * This is where the channel-agnostic business logic happens:
   * 1. Update campaign recipient status
   * 2. Create timeline event
   * 3. Trigger drip campaign progression (if applicable)
   * 4. Update contact engagement scores
   *
   * @private
   */
  private async handleUnifiedEvent(event: UnifiedWebhookEvent): Promise<void> {
    console.log(`[WebhookRouter] Handling unified event:`, {
      channel: event.channel,
      eventType: event.eventType,
      direction: event.direction,
      recipientId: event.recipientId,
      contactId: event.contactId,
    });

    // Step 1: Find recipient if this is tied to a campaign
    let recipient: any = null;
    if (event.recipientId) {
      const recipients = await db
        .select()
        .from(crmCampaignRecipients)
        .where(eq(crmCampaignRecipients.id, event.recipientId))
        .limit(1);
      recipient = recipients[0];
    } else if (event.vendorEventId) {
      // Try to find by vendor event ID (for backward compatibility with Resend)
      const recipients = await db
        .select()
        .from(crmCampaignRecipients)
        .where(eq(crmCampaignRecipients.resendEmailId, event.vendorEventId))
        .limit(1);
      recipient = recipients[0];
    }

    if (!recipient && event.recipientId) {
      console.warn(`[WebhookRouter] Recipient not found:`, event.recipientId);
    }

    // Use workspace ID from event or recipient
    const workspaceId = event.workspaceId || recipient?.workspaceId;
    if (!workspaceId) {
      console.error(`[WebhookRouter] No workspace ID available for event`);
      return;
    }

    // Use contact ID from event or recipient
    const contactId = event.contactId || recipient?.contactId;
    if (!contactId && event.direction === 'inbound') {
      // For inbound messages, we might need to look up or create contact
      console.warn(`[WebhookRouter] No contact ID for inbound message from ${event.from}`);
      // TODO: Implement contact lookup/creation by phone/email
    }

    // Step 2: Update recipient status (if tied to campaign)
    if (recipient) {
      await this.updateRecipientStatus(recipient, event);
    }

    // Step 2b: Update campaign aggregate counters
    if (recipient?.campaignId) {
      await this.updateCampaignCounters(recipient.campaignId, event);
    }

    // Step 3: Create timeline event
    if (contactId) {
      await this.createTimelineEvent(contactId, workspaceId, event);
    }

    // Step 4: Handle drip campaign triggers (if applicable)
    if (recipient && (event.eventType === 'opened' || event.eventType === 'clicked')) {
      await this.checkDripTriggers(recipient, event);
    }

    // Step 5: Update contact engagement (future enhancement)
    // await this.updateContactEngagement(contactId, event);
  }

  /**
   * Update campaign recipient status based on event
   * @private
   */
  private async updateRecipientStatus(recipient: any, event: UnifiedWebhookEvent): Promise<void> {
    const updates: any = {
      updatedAt: new Date(),
    };

    switch (event.eventType) {
      case 'delivered':
        updates.status = 'delivered';
        updates.deliveredAt = event.occurredAt;
        break;

      case 'bounced':
      case 'failed':
        updates.status = 'bounced';
        if (event.email?.bounceType) {
          updates.bounceType = event.email.bounceType;
          updates.bounceDescription = event.email.bounceDescription;
        } else if (event.sms?.errorCode) {
          updates.statusReason = `Error ${event.sms.errorCode}: ${event.sms.carrierStatus}`;
        }
        break;

      case 'opened':
        const isFirstOpen = !recipient.firstOpenedAt;
        if (isFirstOpen) {
          updates.firstOpenedAt = event.occurredAt;
        }
        updates.openCount = (recipient.openCount || 0) + 1;
        break;

      case 'clicked':
        const isFirstClick = !recipient.firstClickedAt;
        if (isFirstClick) {
          updates.firstClickedAt = event.occurredAt;
        }
        updates.clickCount = (recipient.clickCount || 0) + 1;
        break;
    }

    if (Object.keys(updates).length > 1) {
      // Only update if we have more than just updatedAt
      await db
        .update(crmCampaignRecipients)
        .set(updates)
        .where(eq(crmCampaignRecipients.id, recipient.id));

      console.log(`[WebhookRouter] Updated recipient ${recipient.id}:`, updates);
    }
  }

  /**
   * Increment campaign-level aggregate counters
   * @private
   */
  private async updateCampaignCounters(campaignId: string, event: UnifiedWebhookEvent): Promise<void> {
    const updates: Record<string, any> = {};

    switch (event.eventType) {
      case 'delivered':
        updates.totalDelivered = sql`${crmCampaigns.totalDelivered} + 1`;
        break;
      case 'opened':
        updates.totalOpened = sql`${crmCampaigns.totalOpened} + 1`;
        break;
      case 'clicked':
        updates.totalClicked = sql`${crmCampaigns.totalClicked} + 1`;
        break;
      case 'bounced':
      case 'failed':
        // No totalBounced column exists on crmCampaigns — skip
        break;
      default:
        return; // No counter to update for other event types
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db
        .update(crmCampaigns)
        .set(updates)
        .where(eq(crmCampaigns.id, campaignId));

      console.log(`[WebhookRouter] Updated campaign ${campaignId} counters for ${event.eventType}`);
    }
  }

  /**
   * Create timeline event
   * @private
   */
  private async createTimelineEvent(
    contactId: string,
    workspaceId: string,
    event: UnifiedWebhookEvent
  ): Promise<void> {
    // Get timeline event mapping
    const mapping = getTimelineEventMapping(event.channel, event.eventType);
    if (!mapping) {
      console.warn(`[WebhookRouter] No timeline mapping for ${event.channel}.${event.eventType}`);
      return;
    }

    // Build summary
    let summary = '';
    if (event.direction === 'outbound') {
      summary = `${mapping.eventLabel} to ${event.to}`;
    } else {
      summary = `${mapping.eventLabel} from ${event.from}`;
      if (event.content) {
        summary += `: "${event.content.substring(0, 100)}${event.content.length > 100 ? '...' : ''}"`;
      }
    }

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: contactId,
      eventType: mapping.timelineEventType,
      eventCategory: mapping.eventCategory,
      eventLabel: mapping.eventLabel,
      summary,
      occurredAt: event.occurredAt,
      actorType: event.direction === 'inbound' ? 'system' : 'system',
      actorId: null,
      actorName: event.direction === 'inbound' ? event.from : event.metadata?.vendor || 'System',
      communication: {
        channel: event.channel,
        direction: event.direction,
        from: event.from,
        to: event.to,
        content: event.content,
        subject: event.subject,
        vendorEventId: event.vendorEventId,
      },
      metadata: {
        ...event.metadata,
        campaignId: event.campaignId,
        recipientId: event.recipientId,
        channel: event.channel,
        eventType: event.eventType,
      },
    });

    console.log(`[WebhookRouter] Created timeline event: ${mapping.timelineEventType}`);
  }

  /**
   * Check for drip campaign triggers
   * @private
   */
  private async checkDripTriggers(recipient: any, event: UnifiedWebhookEvent): Promise<void> {
    // TODO: Implement drip trigger logic
    // This will be similar to the existing checkDripActionTriggers in resend-webhooks.ts
    console.log(`[WebhookRouter] Drip triggers not yet implemented for ${event.eventType}`);
  }
}

// Singleton instance
let webhookRouter: WebhookRouter | null = null;

/**
 * Get the singleton WebhookRouter instance
 */
export function getWebhookRouter(): WebhookRouter {
  if (!webhookRouter) {
    webhookRouter = new WebhookRouter();
  }
  return webhookRouter;
}
