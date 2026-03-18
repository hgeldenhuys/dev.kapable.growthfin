/**
 * Sandbox Service
 * Core service for sandbox mode — intercepts outbound communications,
 * stores them locally, and can simulate webhook events through the real pipeline.
 */

import { randomUUID } from 'crypto';
import { db } from '@agios/db';
import { crmMockMessages, workspaces } from '@agios/db';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { getWebhookRouter } from './webhook-router';
import type { UnifiedWebhookEvent, ChannelType } from './types';
import type { WorkspaceSettings, WorkspaceSandboxSettings } from '@agios/db/schema/workspaces';

// ============================================================================
// TYPES
// ============================================================================

export interface StoreMessageParams {
  workspaceId: string;
  channel: 'email' | 'sms' | 'voice' | 'ai_voice' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  to: string;
  from: string;
  content: string;
  subject?: string;
  contentHtml?: string;
  campaignId?: string;
  recipientId?: string;
  contactId?: string;
  leadId?: string;
  metadata?: Record<string, any>;
  voiceMetadata?: {
    originalTo?: string;
    isRealCall?: boolean;
    duration?: number;
    recordingUrl?: string;
    transcription?: string;
  };
}

export interface MessageFilter {
  channel?: string;
  direction?: string;
  contactId?: string;
  campaignId?: string;
  status?: string;
}

// ============================================================================
// SANDBOX SERVICE
// ============================================================================

class SandboxService {
  /**
   * Check if sandbox mode is enabled for a workspace.
   * Checks (in order): workspace settings → campaign testMode → SANDBOX_MODE env var
   */
  async isSandboxEnabled(workspaceId: string, campaignTestMode?: boolean): Promise<boolean> {
    // 1. Check env var override
    if (process.env.SANDBOX_MODE === 'true') {
      return true;
    }

    // 2. Check campaign-level testMode
    if (campaignTestMode === true) {
      return true;
    }

    // 3. Check workspace settings
    const config = await this.getConfig(workspaceId);
    return config?.enabled === true;
  }

  /**
   * Get sandbox configuration for a workspace
   */
  async getConfig(workspaceId: string): Promise<WorkspaceSandboxSettings | null> {
    const rows = await db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (rows.length === 0) return null;
    const settings = rows[0].settings as WorkspaceSettings | null;
    return settings?.sandbox ?? null;
  }

  /**
   * Update sandbox configuration for a workspace
   */
  async updateConfig(workspaceId: string, sandboxConfig: Partial<WorkspaceSandboxSettings>): Promise<void> {
    const rows = await db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (rows.length === 0) throw new Error('Workspace not found');

    const currentSettings = (rows[0].settings as WorkspaceSettings) || {};
    const currentSandbox = currentSettings.sandbox || { enabled: false };

    const updatedSettings: WorkspaceSettings = {
      ...currentSettings,
      sandbox: {
        ...currentSandbox,
        ...sandboxConfig,
      },
    };

    await db
      .update(workspaces)
      .set({ settings: updatedSettings as any, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }

  /**
   * Store a sandbox message in crm_mock_messages
   */
  async storeMessage(params: StoreMessageParams): Promise<string> {
    const messageId = `sandbox_${params.channel}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    await db.insert(crmMockMessages).values({
      id: messageId,
      workspaceId: params.workspaceId,
      channel: params.channel as any,
      direction: params.direction as any,
      to: params.to,
      from: params.from,
      content: params.content,
      contentHtml: params.contentHtml,
      subject: params.subject,
      status: 'sent',
      campaignId: params.campaignId,
      recipientId: params.recipientId,
      contactId: params.contactId,
      leadId: params.leadId,
      voiceMetadata: params.voiceMetadata as any,
      events: [{ type: 'sent', timestamp: new Date().toISOString() }] as any,
      metadata: params.metadata as any,
    });

    // Auto-simulate delivery if enabled
    const config = await this.getConfig(params.workspaceId);
    const autoSimulate = config?.autoSimulateDelivery !== false; // Default true
    const delayMs = config?.autoSimulateDelayMs ?? 2000;

    if (autoSimulate && params.direction === 'outbound') {
      setTimeout(() => {
        this.simulateEvent(messageId, 'delivered', params.workspaceId).catch((err) =>
          console.error('[SandboxService] Auto-simulate delivery failed:', err)
        );
      }, delayMs);
    }

    return messageId;
  }

  /**
   * Simulate a webhook event for a sandbox message.
   * Injects the event into the real WebhookRouter pipeline so that
   * recipient status, timeline events, drip triggers, etc. all fire.
   */
  async simulateEvent(
    messageId: string,
    eventType: string,
    workspaceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Look up the stored message
    const messages = await db
      .select()
      .from(crmMockMessages)
      .where(eq(crmMockMessages.id, messageId))
      .limit(1);

    const msg = messages[0];
    if (!msg) throw new Error(`Sandbox message not found: ${messageId}`);

    // Append event to the message's event log
    const events = (msg.events as any[]) || [];
    events.push({ type: eventType, timestamp: new Date().toISOString(), metadata });

    // Update message status
    let newStatus = msg.status;
    if (eventType === 'delivered') newStatus = 'delivered';
    else if (eventType === 'bounced' || eventType === 'failed') newStatus = eventType;
    else if (eventType === 'opened') newStatus = 'opened';
    else if (eventType === 'clicked') newStatus = 'clicked';

    await db
      .update(crmMockMessages)
      .set({ events: events as any, status: newStatus, updatedAt: new Date() })
      .where(eq(crmMockMessages.id, messageId));

    // Build unified event and inject into the real pipeline
    const unifiedEvent: UnifiedWebhookEvent = {
      eventId: randomUUID(),
      vendorEventId: messageId,
      channel: msg.channel as ChannelType,
      eventType,
      direction: 'outbound',
      from: msg.from,
      to: msg.to,
      subject: msg.subject ?? undefined,
      workspaceId: msg.workspaceId,
      campaignId: msg.campaignId ?? undefined,
      recipientId: msg.recipientId ?? undefined,
      contactId: msg.contactId ?? undefined,
      leadId: msg.leadId ?? undefined,
      occurredAt: new Date(),
      metadata: {
        ...metadata,
        sandbox: true,
        sandboxMessageId: messageId,
      },
    };

    // Add channel-specific extensions
    if (eventType === 'bounced' && (msg.channel === 'email')) {
      unifiedEvent.email = {
        bounceType: (metadata?.bounceType as any) || 'hard_bounce',
        bounceDescription: metadata?.bounceDescription || 'Simulated bounce',
      };
    }
    if (eventType === 'clicked' && msg.channel === 'email') {
      unifiedEvent.email = {
        linkUrl: metadata?.linkUrl || 'https://example.com/sandbox-click',
      };
    }

    const router = getWebhookRouter();
    await router.injectEvent(unifiedEvent);

    console.log(`[SandboxService] Simulated ${eventType} for message ${messageId}`);
  }

  /**
   * Simulate an inbound reply from a contact.
   * Creates a new inbound mock message and injects it through the webhook pipeline.
   */
  async simulateReply(
    messageId: string,
    content: string,
    workspaceId: string
  ): Promise<string> {
    // Look up the original outbound message
    const messages = await db
      .select()
      .from(crmMockMessages)
      .where(eq(crmMockMessages.id, messageId))
      .limit(1);

    const original = messages[0];
    if (!original) throw new Error(`Sandbox message not found: ${messageId}`);

    // Create inbound reply message (swap from/to)
    const replyId = await this.storeMessage({
      workspaceId: original.workspaceId,
      channel: original.channel as any,
      direction: 'inbound',
      to: original.from,
      from: original.to,
      content,
      campaignId: original.campaignId ?? undefined,
      contactId: original.contactId ?? undefined,
      leadId: original.leadId ?? undefined,
      metadata: { inReplyTo: messageId },
    });

    // Inject as inbound event
    const unifiedEvent: UnifiedWebhookEvent = {
      eventId: randomUUID(),
      vendorEventId: replyId,
      channel: original.channel as ChannelType,
      eventType: 'received',
      direction: 'inbound',
      from: original.to,
      to: original.from,
      content,
      workspaceId: original.workspaceId,
      campaignId: original.campaignId ?? undefined,
      contactId: original.contactId ?? undefined,
      leadId: original.leadId ?? undefined,
      occurredAt: new Date(),
      metadata: {
        sandbox: true,
        sandboxMessageId: replyId,
        inReplyTo: messageId,
      },
    };

    const router = getWebhookRouter();
    await router.injectEvent(unifiedEvent);

    console.log(`[SandboxService] Simulated reply for message ${messageId}`);
    return replyId;
  }

  /**
   * List sandbox messages with filtering
   */
  async listMessages(workspaceId: string, filters?: MessageFilter, limit = 50, offset = 0) {
    const conditions = [
      eq(crmMockMessages.workspaceId, workspaceId),
      isNull(crmMockMessages.deletedAt),
    ];

    if (filters?.channel) {
      conditions.push(eq(crmMockMessages.channel, filters.channel as any));
    }
    if (filters?.direction) {
      conditions.push(eq(crmMockMessages.direction, filters.direction as any));
    }
    if (filters?.contactId) {
      conditions.push(eq(crmMockMessages.contactId, filters.contactId));
    }
    if (filters?.campaignId) {
      conditions.push(eq(crmMockMessages.campaignId, filters.campaignId));
    }
    if (filters?.status) {
      conditions.push(eq(crmMockMessages.status, filters.status));
    }

    const rows = await db
      .select()
      .from(crmMockMessages)
      .where(and(...conditions))
      .orderBy(desc(crmMockMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  /**
   * Get a single sandbox message by ID
   */
  async getMessage(messageId: string, workspaceId: string) {
    const rows = await db
      .select()
      .from(crmMockMessages)
      .where(and(eq(crmMockMessages.id, messageId), eq(crmMockMessages.workspaceId, workspaceId)))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Get aggregate stats for sandbox messages
   */
  async getStats(workspaceId: string) {
    const rows = await db
      .select({
        channel: crmMockMessages.channel,
        direction: crmMockMessages.direction,
        status: crmMockMessages.status,
        count: sql<number>`count(*)::int`,
      })
      .from(crmMockMessages)
      .where(and(eq(crmMockMessages.workspaceId, workspaceId), isNull(crmMockMessages.deletedAt)))
      .groupBy(crmMockMessages.channel, crmMockMessages.direction, crmMockMessages.status);

    // Aggregate into a summary
    const stats: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number; replied: number }> = {};

    for (const row of rows) {
      const ch = row.channel;
      if (!stats[ch]) {
        stats[ch] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, replied: 0 };
      }

      if (row.direction === 'outbound') {
        // Cumulative counting: a message that reached "clicked" also passed through sent, delivered, opened
        const status = row.status;
        if (status === 'sent' || status === 'pending' || status === 'delivered' || status === 'opened' || status === 'clicked') {
          stats[ch].sent += row.count;
        }
        if (status === 'delivered' || status === 'opened' || status === 'clicked') {
          stats[ch].delivered += row.count;
        }
        if (status === 'opened' || status === 'clicked') {
          stats[ch].opened += row.count;
        }
        if (status === 'clicked') {
          stats[ch].clicked += row.count;
        }
        if (status === 'bounced' || status === 'failed') {
          stats[ch].bounced += row.count;
        }
      } else if (row.direction === 'inbound') {
        stats[ch].replied += row.count;
      }
    }

    return stats;
  }

  /**
   * Clear all sandbox data for a workspace (soft delete)
   */
  async clearMessages(workspaceId: string): Promise<number> {
    const result = await db
      .update(crmMockMessages)
      .set({ deletedAt: new Date() })
      .where(and(eq(crmMockMessages.workspaceId, workspaceId), isNull(crmMockMessages.deletedAt)));

    return (result as any).rowCount ?? 0;
  }
}

// Singleton
export const sandboxService = new SandboxService();
