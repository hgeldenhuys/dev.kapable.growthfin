/**
 * Webhook Delivery Service (Phase T)
 * Handles dispatching CRM events to webhook subscriptions,
 * delivering payloads with HMAC signatures, and retry logic.
 */

import crypto from 'crypto';
import type { Database } from '@agios/db';
import {
  crmWebhookSubscriptions,
  crmWebhookDeliveries,
} from '@agios/db/schema';
import { eq, and, lte, desc, count } from 'drizzle-orm';
import type {
  CrmWebhookDelivery,
  CrmWebhookSubscription,
  RetryPolicy,
} from '@agios/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DeliveryStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  retrying: number;
}

// ============================================================================
// Service
// ============================================================================

export class WebhookDeliveryService {
  /**
   * Dispatch an event to all matching active subscriptions for a workspace.
   * Creates delivery records and attempts delivery for each subscription.
   */
  async dispatchEvent(
    db: Database,
    workspaceId: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // Find active subscriptions that include this event
    const subscriptions = await db
      .select()
      .from(crmWebhookSubscriptions)
      .where(
        and(
          eq(crmWebhookSubscriptions.workspaceId, workspaceId),
          eq(crmWebhookSubscriptions.isActive, true)
        )
      );

    // Filter subscriptions that listen for this event type
    const matching = subscriptions.filter((sub: CrmWebhookSubscription) => {
      const events = sub.events as string[];
      return events.includes(eventType) || events.includes('*');
    });

    // Create delivery records and attempt delivery for each
    for (const subscription of matching) {
      const retryPolicy = (subscription.retryPolicy as RetryPolicy) || {
        maxRetries: 3,
        backoffMs: 1000,
      };

      const payload: WebhookPayload = {
        id: crypto.randomUUID(),
        event: eventType,
        timestamp: new Date().toISOString(),
        data,
      };

      const [delivery] = await db
        .insert(crmWebhookDeliveries)
        .values({
          subscriptionId: subscription.id,
          workspaceId,
          eventType,
          payload,
          status: 'pending',
          maxAttempts: retryPolicy.maxRetries + 1, // initial attempt + retries
        })
        .returning();

      // Attempt delivery (fire-and-forget, errors caught internally)
      this.deliverWebhook(db, delivery.id).catch((err) => {
        console.error(
          `[webhook-delivery] Failed to deliver webhook ${delivery.id}:`,
          err
        );
      });
    }
  }

  /**
   * Deliver a single webhook by its delivery ID.
   * POSTs to the subscription URL with HMAC signature and custom headers.
   * Updates the delivery record with the result.
   */
  async deliverWebhook(db: Database, deliveryId: string): Promise<void> {
    // Load delivery and subscription
    const [delivery] = await db
      .select()
      .from(crmWebhookDeliveries)
      .where(eq(crmWebhookDeliveries.id, deliveryId));

    if (!delivery) {
      console.error(`[webhook-delivery] Delivery ${deliveryId} not found`);
      return;
    }

    const [subscription] = await db
      .select()
      .from(crmWebhookSubscriptions)
      .where(eq(crmWebhookSubscriptions.id, delivery.subscriptionId));

    if (!subscription) {
      console.error(
        `[webhook-delivery] Subscription ${delivery.subscriptionId} not found`
      );
      await db
        .update(crmWebhookDeliveries)
        .set({ status: 'failed', error: 'Subscription not found' })
        .where(eq(crmWebhookDeliveries.id, deliveryId));
      return;
    }

    // Build request headers
    const payloadString = JSON.stringify(delivery.payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NewLeads-Webhooks/1.0',
      'X-Webhook-Event': delivery.eventType,
      'X-Webhook-Delivery-Id': delivery.id,
    };

    // Add HMAC signature if secret is set
    if (subscription.secret) {
      const signature = this.generateSignature(
        payloadString,
        subscription.secret
      );
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Add custom headers from subscription
    if (subscription.headers && typeof subscription.headers === 'object') {
      const customHeaders = subscription.headers as Record<string, string>;
      for (const [key, value] of Object.entries(customHeaders)) {
        headers[key] = value;
      }
    }

    const startTime = Date.now();

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      const responseTimeMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // Success
        await db
          .update(crmWebhookDeliveries)
          .set({
            status: 'success',
            httpStatus: response.status,
            responseBody: responseBody.substring(0, 1000), // Truncate
            responseTimeMs,
            deliveredAt: new Date(),
          })
          .where(eq(crmWebhookDeliveries.id, deliveryId));
      } else {
        // HTTP error - schedule retry if attempts remain
        await this.handleFailure(
          db,
          delivery,
          subscription,
          `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
          response.status,
          responseBody.substring(0, 1000),
          responseTimeMs
        );
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.handleFailure(
        db,
        delivery,
        subscription,
        errorMessage,
        undefined,
        undefined,
        responseTimeMs
      );
    }
  }

  /**
   * Handle a failed delivery attempt. Schedule retry if attempts remain.
   */
  private async handleFailure(
    db: Database,
    delivery: CrmWebhookDelivery,
    subscription: CrmWebhookSubscription,
    error: string,
    httpStatus?: number,
    responseBody?: string,
    responseTimeMs?: number
  ): Promise<void> {
    const retryPolicy = (subscription.retryPolicy as RetryPolicy) || {
      maxRetries: 3,
      backoffMs: 1000,
    };

    const nextAttempt = delivery.attemptNumber + 1;
    const maxAttempts = delivery.maxAttempts || retryPolicy.maxRetries + 1;

    if (nextAttempt <= maxAttempts) {
      // Calculate exponential backoff
      const backoffMs =
        retryPolicy.backoffMs * Math.pow(2, delivery.attemptNumber - 1);
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await db
        .update(crmWebhookDeliveries)
        .set({
          status: 'retrying',
          httpStatus: httpStatus ?? null,
          responseBody: responseBody ?? null,
          responseTimeMs: responseTimeMs ?? null,
          error,
          attemptNumber: nextAttempt,
          nextRetryAt,
        })
        .where(eq(crmWebhookDeliveries.id, delivery.id));
    } else {
      // Max attempts reached
      await db
        .update(crmWebhookDeliveries)
        .set({
          status: 'failed',
          httpStatus: httpStatus ?? null,
          responseBody: responseBody ?? null,
          responseTimeMs: responseTimeMs ?? null,
          error,
        })
        .where(eq(crmWebhookDeliveries.id, delivery.id));
    }
  }

  /**
   * Retry failed deliveries that are due for retry.
   * Returns the number of deliveries retried.
   */
  async retryFailed(db: Database, workspaceId: string): Promise<number> {
    const now = new Date();

    // Find deliveries with status='retrying' and nextRetryAt <= now
    const dueRetries = await db
      .select()
      .from(crmWebhookDeliveries)
      .where(
        and(
          eq(crmWebhookDeliveries.workspaceId, workspaceId),
          eq(crmWebhookDeliveries.status, 'retrying'),
          lte(crmWebhookDeliveries.nextRetryAt, now)
        )
      );

    let retriedCount = 0;

    for (const delivery of dueRetries) {
      // Mark as pending before re-attempting
      await db
        .update(crmWebhookDeliveries)
        .set({ status: 'pending' })
        .where(eq(crmWebhookDeliveries.id, delivery.id));

      // Re-attempt delivery
      this.deliverWebhook(db, delivery.id).catch((err) => {
        console.error(
          `[webhook-delivery] Retry failed for ${delivery.id}:`,
          err
        );
      });

      retriedCount++;
    }

    return retriedCount;
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload.
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * List deliveries for a subscription with optional limit.
   */
  async listDeliveries(
    db: Database,
    subscriptionId: string,
    workspaceId: string,
    limit = 50
  ): Promise<CrmWebhookDelivery[]> {
    return db
      .select()
      .from(crmWebhookDeliveries)
      .where(
        and(
          eq(crmWebhookDeliveries.subscriptionId, subscriptionId),
          eq(crmWebhookDeliveries.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(crmWebhookDeliveries.createdAt))
      .limit(limit);
  }

  /**
   * Get delivery statistics for a workspace.
   */
  async getDeliveryStats(
    db: Database,
    workspaceId: string
  ): Promise<DeliveryStats> {
    const results = await db
      .select({
        status: crmWebhookDeliveries.status,
        count: count(),
      })
      .from(crmWebhookDeliveries)
      .where(eq(crmWebhookDeliveries.workspaceId, workspaceId))
      .groupBy(crmWebhookDeliveries.status);

    const stats: DeliveryStats = {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      retrying: 0,
    };

    for (const row of results) {
      const cnt = Number(row.count);
      stats.total += cnt;
      if (row.status === 'success') stats.success = cnt;
      else if (row.status === 'failed') stats.failed = cnt;
      else if (row.status === 'pending') stats.pending = cnt;
      else if (row.status === 'retrying') stats.retrying = cnt;
    }

    return stats;
  }

  /**
   * Send a test event to a specific subscription.
   */
  async sendTestEvent(
    db: Database,
    subscriptionId: string,
    workspaceId: string
  ): Promise<CrmWebhookDelivery> {
    const [subscription] = await db
      .select()
      .from(crmWebhookSubscriptions)
      .where(
        and(
          eq(crmWebhookSubscriptions.id, subscriptionId),
          eq(crmWebhookSubscriptions.workspaceId, workspaceId)
        )
      );

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const events = subscription.events as string[];
    const testEvent = events[0] || 'test.ping';

    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      event: testEvent,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery from NewLeads',
        subscription: {
          id: subscription.id,
          name: subscription.name,
        },
      },
    };

    const [delivery] = await db
      .insert(crmWebhookDeliveries)
      .values({
        subscriptionId: subscription.id,
        workspaceId,
        eventType: testEvent,
        payload,
        status: 'pending',
        maxAttempts: 1, // No retries for test events
      })
      .returning();

    // Attempt delivery
    await this.deliverWebhook(db, delivery.id);

    // Return updated delivery with result
    const [updated] = await db
      .select()
      .from(crmWebhookDeliveries)
      .where(eq(crmWebhookDeliveries.id, delivery.id));

    return updated;
  }
}

export const webhookDeliveryService = new WebhookDeliveryService();
