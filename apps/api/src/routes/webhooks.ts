/**
 * Webhooks API Routes
 *
 * Endpoints for managing webhook configurations:
 * - GET /v1/webhooks - List webhooks for project
 * - POST /v1/webhooks - Create webhook
 * - GET /v1/webhooks/:id - Get webhook details
 * - PATCH /v1/webhooks/:id - Update webhook
 * - DELETE /v1/webhooks/:id - Delete webhook
 * - GET /v1/webhooks/:id/logs - Get delivery history
 * - POST /v1/webhooks/:id/test - Send test event
 */

import { sql as mainSql } from '../lib/db';
import { queueWebhook, deliverWebhookNow } from '../lib/webhook-delivery';
import type { ApiContext, WebhookConfig, WebhookLogEntry, CreateWebhookRequest, UpdateWebhookRequest } from '../types';
import crypto from 'crypto';

/**
 * Generate a secure webhook secret
 */
function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}

/**
 * Validate URL is HTTPS (production requirement)
 */
function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    // Allow http for localhost in development
    if (parsed.protocol !== 'https:' && !parsed.hostname.match(/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/)) {
      return { valid: false, error: 'Webhook URL must use HTTPS' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate events array
 */
function validateEvents(events: string[]): { valid: boolean; error?: string } {
  const validEvents = ['insert', 'update', 'delete', 'bulk'];
  for (const event of events) {
    if (!validEvents.includes(event)) {
      return { valid: false, error: `Invalid event type: ${event}. Valid types: ${validEvents.join(', ')}` };
    }
  }
  return { valid: true };
}

/**
 * POST /v1/webhooks - Create a new webhook
 */
export async function createWebhook(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  let body: CreateWebhookRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.url) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return Response.json({ error: 'events array is required and must not be empty' }, { status: 400 });
  }

  // Validate URL
  const urlValidation = validateWebhookUrl(body.url);
  if (!urlValidation.valid) {
    return Response.json({ error: urlValidation.error }, { status: 400 });
  }

  // Validate events
  const eventsValidation = validateEvents(body.events);
  if (!eventsValidation.valid) {
    return Response.json({ error: eventsValidation.error }, { status: 400 });
  }

  // Generate secret
  const secret = generateSecret();

  try {
    const result = await mainSql`
      INSERT INTO project_webhooks (project_id, url, secret, events, tables, headers, enabled)
      VALUES (
        ${ctx.projectId},
        ${body.url},
        ${secret},
        ${body.events},
        ${body.tables || null},
        ${JSON.stringify(body.headers || {})},
        ${body.enabled !== false}
      )
      RETURNING id, url, events, tables, headers, enabled, created_at, updated_at
    `;

    const webhook = result[0];
    return Response.json({
      id: webhook.id,
      url: webhook.url,
      secret, // Only returned on creation
      events: webhook.events,
      tables: webhook.tables,
      headers: webhook.headers,
      enabled: webhook.enabled,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at,
    }, { status: 201 });

  } catch (error) {
    console.error('[webhooks] Error creating webhook:', error);
    return Response.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

/**
 * GET /v1/webhooks - List webhooks for project
 */
export async function listWebhooks(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    // Get total count
    const countResult = await mainSql`
      SELECT COUNT(*) as total FROM project_webhooks WHERE project_id = ${ctx.projectId}
    `;
    const total = parseInt(countResult[0]?.total || '0');

    // Get webhooks (without secret)
    const webhooks = await mainSql`
      SELECT id, url, events, tables, headers, enabled, created_at, updated_at
      FROM project_webhooks
      WHERE project_id = ${ctx.projectId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return Response.json({
      data: webhooks,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[webhooks] Error listing webhooks:', error);
    return Response.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}

/**
 * GET /v1/webhooks/:id - Get webhook details
 */
export async function getWebhook(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  try {
    const result = await mainSql`
      SELECT id, url, events, tables, headers, enabled, created_at, updated_at
      FROM project_webhooks
      WHERE id = ${id} AND project_id = ${ctx.projectId}
    `;

    if (result.length === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return Response.json(result[0]);

  } catch (error) {
    console.error('[webhooks] Error getting webhook:', error);
    return Response.json({ error: 'Failed to get webhook' }, { status: 500 });
  }
}

/**
 * PATCH /v1/webhooks/:id - Update webhook
 */
export async function updateWebhook(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  let body: UpdateWebhookRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate URL if provided
  if (body.url !== undefined) {
    const urlValidation = validateWebhookUrl(body.url);
    if (!urlValidation.valid) {
      return Response.json({ error: urlValidation.error }, { status: 400 });
    }
  }

  // Validate events if provided
  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return Response.json({ error: 'events must be a non-empty array' }, { status: 400 });
    }
    const eventsValidation = validateEvents(body.events);
    if (!eventsValidation.valid) {
      return Response.json({ error: eventsValidation.error }, { status: 400 });
    }
  }

  try {
    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.url !== undefined) {
      updates.push('url = $' + (values.length + 1));
      values.push(body.url);
    }
    if (body.events !== undefined) {
      updates.push('events = $' + (values.length + 1));
      values.push(body.events);
    }
    if (body.tables !== undefined) {
      updates.push('tables = $' + (values.length + 1));
      values.push(body.tables);
    }
    if (body.headers !== undefined) {
      updates.push('headers = $' + (values.length + 1));
      values.push(JSON.stringify(body.headers));
    }
    if (body.enabled !== undefined) {
      updates.push('enabled = $' + (values.length + 1));
      values.push(body.enabled);
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Add WHERE clause params
    values.push(id, ctx.projectId);

    const result = await mainSql.unsafe(
      `UPDATE project_webhooks
       SET ${updates.join(', ')}
       WHERE id = $${values.length - 1} AND project_id = $${values.length}
       RETURNING id, url, events, tables, headers, enabled, created_at, updated_at`,
      values
    );

    if (result.length === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return Response.json(result[0]);

  } catch (error) {
    console.error('[webhooks] Error updating webhook:', error);
    return Response.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

/**
 * DELETE /v1/webhooks/:id - Delete webhook
 */
export async function deleteWebhook(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  try {
    const result = await mainSql`
      DELETE FROM project_webhooks
      WHERE id = ${id} AND project_id = ${ctx.projectId}
      RETURNING id
    `;

    if (result.length === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return new Response(null, { status: 204 });

  } catch (error) {
    console.error('[webhooks] Error deleting webhook:', error);
    return Response.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}

/**
 * GET /v1/webhooks/:id/logs - Get delivery history
 */
export async function getWebhookLogs(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const successFilter = url.searchParams.get('success');

  try {
    // Verify webhook belongs to project
    const webhook = await mainSql`
      SELECT id FROM project_webhooks WHERE id = ${id} AND project_id = ${ctx.projectId}
    `;

    if (webhook.length === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build query
    let whereClause = 'webhook_id = $1';
    const queryParams: unknown[] = [id];

    if (successFilter !== null) {
      whereClause += ' AND success = $2';
      queryParams.push(successFilter === 'true');
    }

    // Get total count
    const countResult = await mainSql.unsafe(
      `SELECT COUNT(*) as total FROM project_webhooks_log WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult[0]?.total || '0');

    // Get logs
    const logs = await mainSql.unsafe(
      `SELECT id, payload, response_status, response_body, duration_ms, success, error, attempt_number, created_at
       FROM project_webhooks_log
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    return Response.json({
      data: logs,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[webhooks] Error getting webhook logs:', error);
    return Response.json({ error: 'Failed to get webhook logs' }, { status: 500 });
  }
}

/**
 * POST /v1/webhooks/:id/test - Send test event
 */
export async function testWebhook(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  try {
    // Get webhook config
    const result = await mainSql`
      SELECT id, url, secret, headers, enabled
      FROM project_webhooks
      WHERE id = ${id} AND project_id = ${ctx.projectId}
    `;

    if (result.length === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const webhook = result[0] as WebhookConfig;

    // Create test payload
    const testPayload = {
      event: 'test',
      webhook_id: id,
      project_id: ctx.projectId,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        id: crypto.randomUUID(),
      },
    };

    // Deliver immediately (bypasses queue)
    const deliveryResult = await deliverWebhookNow(webhook, testPayload);

    // Log the delivery
    await mainSql`
      INSERT INTO project_webhooks_log (
        webhook_id, payload, response_status, response_body,
        duration_ms, success, error, attempt_number
      )
      VALUES (
        ${id},
        ${JSON.stringify(testPayload)},
        ${deliveryResult.status || null},
        ${deliveryResult.body || null},
        ${deliveryResult.durationMs || null},
        ${deliveryResult.success},
        ${deliveryResult.error || null},
        1
      )
    `;

    if (deliveryResult.success) {
      return Response.json({
        success: true,
        status: deliveryResult.status,
        duration_ms: deliveryResult.durationMs,
      });
    } else {
      return Response.json({
        success: false,
        error: deliveryResult.error,
        status: deliveryResult.status,
        duration_ms: deliveryResult.durationMs,
      }, { status: 502 });
    }

  } catch (error) {
    console.error('[webhooks] Error testing webhook:', error);
    return Response.json({ error: 'Failed to test webhook' }, { status: 500 });
  }
}

/**
 * POST /v1/webhooks/:id/rotate-secret - Rotate webhook secret
 */
export async function rotateWebhookSecret(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  try {
    const newSecret = generateSecret();

    const result = await mainSql`
      UPDATE project_webhooks
      SET secret = ${newSecret}
      WHERE id = ${id} AND project_id = ${ctx.projectId}
      RETURNING id, url, events, tables, headers, enabled, created_at, updated_at
    `;

    if (result.length === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return Response.json({
      ...result[0],
      secret: newSecret, // Only returned on rotation
    });

  } catch (error) {
    console.error('[webhooks] Error rotating webhook secret:', error);
    return Response.json({ error: 'Failed to rotate webhook secret' }, { status: 500 });
  }
}
