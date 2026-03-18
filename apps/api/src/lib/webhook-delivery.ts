/**
 * Webhook Delivery Service
 *
 * Handles queuing and delivering webhooks with:
 * - HMAC-SHA256 signature verification
 * - Exponential backoff retries
 * - Delivery logging
 */

import { sql as mainSql } from './db';
import type { WebhookConfig, WebhookEvent, DeliveryResult } from '../types';
import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function signPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Get active webhooks for a project, event, and table
 */
export async function getActiveWebhooks(
  projectId: string,
  event: string,
  table: string
): Promise<WebhookConfig[]> {
  try {
    const webhooks = await mainSql`
      SELECT id, url, secret, headers
      FROM project_webhooks
      WHERE project_id = ${projectId}
        AND enabled = true
        AND ${event} = ANY(events)
        AND (tables IS NULL OR ${table} = ANY(tables))
    `;

    return webhooks.map(w => ({
      id: w.id,
      url: w.url,
      secret: w.secret,
      headers: typeof w.headers === 'string' ? JSON.parse(w.headers) : (w.headers || {}),
    }));
  } catch (error) {
    console.error('[webhook-delivery] Error getting active webhooks:', error);
    return [];
  }
}

/**
 * Queue webhook for delivery
 */
export async function queueWebhook(
  projectId: string,
  event: WebhookEvent
): Promise<void> {
  try {
    // Get all active webhooks that match this event
    const webhooks = await getActiveWebhooks(projectId, event.event, event.table);

    if (webhooks.length === 0) {
      return;
    }

    console.log(`[webhook-delivery] Queuing ${webhooks.length} webhooks for ${event.event} on ${event.table}`);

    // Queue each webhook
    for (const webhook of webhooks) {
      const payload = {
        id: crypto.randomUUID(),
        event: event.event,
        table: event.table,
        project_id: projectId,
        timestamp: event.timestamp,
        data: event.data,
      };

      await mainSql`
        INSERT INTO project_webhooks_queue (webhook_id, payload)
        VALUES (${webhook.id}, ${JSON.stringify(payload)})
      `;
    }
  } catch (error) {
    console.error('[webhook-delivery] Error queuing webhook:', error);
  }
}

/**
 * Deliver webhook immediately (bypasses queue)
 * Used for test deliveries
 */
export async function deliverWebhookNow(
  webhook: WebhookConfig,
  payload: object
): Promise<DeliveryResult> {
  const startTime = Date.now();
  const payloadStr = JSON.stringify(payload);
  const signature = signPayload(payloadStr, webhook.secret);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': new Date().toISOString(),
    'User-Agent': 'SignalDB-Webhooks/1.0',
    ...(webhook.headers || {}),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const durationMs = Date.now() - startTime;
    let body: string | null = null;

    try {
      body = await response.text();
      // Truncate body if too large
      if (body.length > 4096) {
        body = body.substring(0, 4096) + '... (truncated)';
      }
    } catch {
      // Ignore body read errors
    }

    if (response.ok) {
      return {
        success: true,
        status: response.status,
        body,
        durationMs,
      };
    } else {
      return {
        success: false,
        status: response.status,
        body,
        durationMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          durationMs,
          error: 'Request timeout (30s)',
        };
      }
      return {
        success: false,
        durationMs,
        error: error.message,
      };
    }

    return {
      success: false,
      durationMs,
      error: 'Unknown error',
    };
  }
}

/**
 * Process pending webhook queue items
 * Called by the webhook worker
 */
export async function processWebhookQueue(batchSize: number = 10): Promise<number> {
  try {
    // Get pending items that are due for delivery
    const items = await mainSql`
      SELECT
        q.id as queue_id,
        q.webhook_id,
        q.payload,
        q.attempts,
        w.url,
        w.secret,
        w.headers
      FROM project_webhooks_queue q
      JOIN project_webhooks w ON w.id = q.webhook_id
      WHERE q.next_attempt_at <= NOW()
        AND q.attempts < 5
        AND w.enabled = true
      ORDER BY q.next_attempt_at ASC
      LIMIT ${batchSize}
      FOR UPDATE OF q SKIP LOCKED
    `;

    if (items.length === 0) {
      return 0;
    }

    console.log(`[webhook-delivery] Processing ${items.length} pending webhooks`);

    let processed = 0;

    for (const item of items) {
      const webhook: WebhookConfig = {
        id: item.webhook_id,
        url: item.url,
        secret: item.secret,
        headers: typeof item.headers === 'string' ? JSON.parse(item.headers) : (item.headers || {}),
      };

      const payload = typeof item.payload === 'string'
        ? JSON.parse(item.payload)
        : item.payload;

      const result = await deliverWebhookNow(webhook, payload);

      if (result.success) {
        // Success - remove from queue and log
        await mainSql`
          SELECT mark_delivery_success(
            ${item.queue_id}::uuid,
            ${result.status},
            ${result.body},
            NULL,
            ${result.durationMs}
          )
        `;
        console.log(`[webhook-delivery] Successfully delivered to ${webhook.url}`);
      } else {
        // Failure - reschedule or archive
        await mainSql`
          SELECT mark_delivery_failed(
            ${item.queue_id}::uuid,
            ${result.error || 'Unknown error'},
            ${result.status || null},
            ${result.body || null},
            NULL,
            ${result.durationMs || null}
          )
        `;
        console.log(`[webhook-delivery] Failed to deliver to ${webhook.url}: ${result.error}`);
      }

      processed++;
    }

    return processed;
  } catch (error) {
    console.error('[webhook-delivery] Error processing webhook queue:', error);
    return 0;
  }
}

/**
 * Get queue stats for monitoring
 */
export async function getQueueStats(): Promise<{
  pending: number;
  failed: number;
  processed_today: number;
}> {
  try {
    const stats = await mainSql`
      SELECT
        (SELECT COUNT(*) FROM project_webhooks_queue WHERE attempts < 5) as pending,
        (SELECT COUNT(*) FROM project_webhooks_queue WHERE attempts >= 5) as failed,
        (SELECT COUNT(*) FROM project_webhooks_log WHERE created_at >= CURRENT_DATE) as processed_today
    `;

    return {
      pending: parseInt(stats[0]?.pending || '0'),
      failed: parseInt(stats[0]?.failed || '0'),
      processed_today: parseInt(stats[0]?.processed_today || '0'),
    };
  } catch (error) {
    console.error('[webhook-delivery] Error getting queue stats:', error);
    return { pending: 0, failed: 0, processed_today: 0 };
  }
}

/**
 * Clean up old webhook logs (retention policy)
 */
export async function cleanupOldLogs(retentionDays: number = 30): Promise<number> {
  try {
    const result = await mainSql`
      WITH deleted AS (
        DELETE FROM project_webhooks_log
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `;

    return parseInt(result[0]?.count || '0');
  } catch (error) {
    console.error('[webhook-delivery] Error cleaning up old logs:', error);
    return 0;
  }
}
