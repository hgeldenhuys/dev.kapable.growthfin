/**
 * Integration Routes (Phase T)
 * REST endpoints for webhook subscriptions, deliveries, API keys, and the event catalog.
 */

import { Elysia, t } from 'elysia';
import { webhookDeliveryService } from '../services/webhook-delivery.service';
import { apiKeyService } from '../services/api-key.service';
import { getEventCategories, isValidEvent } from '../services/event-catalog';
import {
  crmWebhookSubscriptions,
  crmWebhookDeliveries,
} from '@agios/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================================================
// Integration Routes
// ============================================================================

export const integrationRoutes = new Elysia({ prefix: '/integrations' })
  // ==========================================================================
  // Event Catalog
  // ==========================================================================
  .get(
    '/events',
    async () => {
      const categories = getEventCategories();
      return { categories };
    },
    {
      detail: {
        tags: ['Integrations'],
        summary: 'List subscribable events',
        description: 'Get all subscribable CRM events grouped by category',
      },
    }
  )

  // ==========================================================================
  // Webhook Subscriptions
  // ==========================================================================
  .get(
    '/webhooks',
    async ({ db, query }) => {
      const subscriptions = await db
        .select()
        .from(crmWebhookSubscriptions)
        .where(eq(crmWebhookSubscriptions.workspaceId, query.workspaceId))
        .orderBy(desc(crmWebhookSubscriptions.createdAt));
      return { subscriptions };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'List webhook subscriptions',
        description: 'List all webhook subscriptions for a workspace',
      },
    }
  )
  .post(
    '/webhooks',
    async ({ db, body, set }) => {
      try {
        // Validate events
        for (const event of body.events) {
          if (event !== '*' && !isValidEvent(event)) {
            set.status = 400;
            return { error: `Invalid event type: ${event}` };
          }
        }

        const [subscription] = await db
          .insert(crmWebhookSubscriptions)
          .values({
            workspaceId: body.workspaceId,
            name: body.name,
            url: body.url,
            events: body.events,
            secret: body.secret ?? null,
            headers: body.headers ?? null,
            retryPolicy: body.retryPolicy ?? { maxRetries: 3, backoffMs: 1000 },
            rateLimitPerMinute: body.rateLimitPerMinute ?? 60,
            createdBy: body.createdBy ?? null,
          })
          .returning();

        set.status = 201;
        return subscription;
      } catch (error) {
        console.error('[integrations/webhooks POST] Error:', error);
        set.status = 400;
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to create webhook subscription',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        url: t.String(),
        events: t.Array(t.String()),
        secret: t.Optional(t.String()),
        headers: t.Optional(t.Record(t.String(), t.String())),
        retryPolicy: t.Optional(
          t.Object({
            maxRetries: t.Number(),
            backoffMs: t.Number(),
          })
        ),
        rateLimitPerMinute: t.Optional(t.Number()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Create webhook subscription',
        description:
          'Create a new webhook subscription for CRM events. Events must be valid event types from the catalog.',
      },
    }
  )
  .get(
    '/webhooks/:id',
    async ({ db, params, query }) => {
      const [subscription] = await db
        .select()
        .from(crmWebhookSubscriptions)
        .where(
          and(
            eq(crmWebhookSubscriptions.id, params.id),
            eq(crmWebhookSubscriptions.workspaceId, query.workspaceId)
          )
        );

      if (!subscription) {
        return { error: 'Webhook subscription not found' };
      }

      // Get recent deliveries
      const deliveries = await webhookDeliveryService.listDeliveries(
        db,
        params.id,
        query.workspaceId,
        20
      );

      return { subscription, deliveries };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Get webhook subscription',
        description:
          'Get a webhook subscription with its recent delivery history',
      },
    }
  )
  .patch(
    '/webhooks/:id',
    async ({ db, params, body, set }) => {
      try {
        // Validate events if provided
        if (body.events) {
          for (const event of body.events) {
            if (event !== '*' && !isValidEvent(event)) {
              set.status = 400;
              return { error: `Invalid event type: ${event}` };
            }
          }
        }

        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (body.name !== undefined) updateData['name'] = body.name;
        if (body.url !== undefined) updateData['url'] = body.url;
        if (body.events !== undefined) updateData['events'] = body.events;
        if (body.secret !== undefined) updateData['secret'] = body.secret;
        if (body.headers !== undefined) updateData['headers'] = body.headers;
        if (body.isActive !== undefined) updateData['isActive'] = body.isActive;
        if (body.retryPolicy !== undefined)
          updateData['retryPolicy'] = body.retryPolicy;
        if (body.rateLimitPerMinute !== undefined)
          updateData['rateLimitPerMinute'] = body.rateLimitPerMinute;

        const [updated] = await db
          .update(crmWebhookSubscriptions)
          .set(updateData)
          .where(
            and(
              eq(crmWebhookSubscriptions.id, params.id),
              eq(crmWebhookSubscriptions.workspaceId, body.workspaceId)
            )
          )
          .returning();

        if (!updated) {
          set.status = 404;
          return { error: 'Webhook subscription not found' };
        }

        return updated;
      } catch (error) {
        console.error('[integrations/webhooks PATCH] Error:', error);
        set.status = 400;
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to update webhook subscription',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        url: t.Optional(t.String()),
        events: t.Optional(t.Array(t.String())),
        secret: t.Optional(t.String()),
        headers: t.Optional(t.Record(t.String(), t.String())),
        isActive: t.Optional(t.Boolean()),
        retryPolicy: t.Optional(
          t.Object({
            maxRetries: t.Number(),
            backoffMs: t.Number(),
          })
        ),
        rateLimitPerMinute: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Update webhook subscription',
        description: 'Update an existing webhook subscription',
      },
    }
  )
  .delete(
    '/webhooks/:id',
    async ({ db, params, query, set }) => {
      const [deleted] = await db
        .delete(crmWebhookSubscriptions)
        .where(
          and(
            eq(crmWebhookSubscriptions.id, params.id),
            eq(crmWebhookSubscriptions.workspaceId, query.workspaceId)
          )
        )
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: 'Webhook subscription not found' };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Delete webhook subscription',
        description:
          'Delete a webhook subscription. This also deletes all associated delivery records.',
      },
    }
  )
  .post(
    '/webhooks/:id/test',
    async ({ db, params, body, set }) => {
      try {
        const delivery = await webhookDeliveryService.sendTestEvent(
          db,
          params.id,
          body.workspaceId
        );
        return { delivery };
      } catch (error) {
        console.error('[integrations/webhooks/test POST] Error:', error);
        set.status = 400;
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to send test event',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Send test webhook event',
        description:
          'Send a test event to a webhook subscription to verify the endpoint is working',
      },
    }
  )

  // ==========================================================================
  // Webhook Deliveries
  // ==========================================================================
  .get(
    '/webhooks/:id/deliveries',
    async ({ db, params, query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const deliveries = await webhookDeliveryService.listDeliveries(
        db,
        params.id,
        query.workspaceId,
        limit
      );
      return { deliveries };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'List webhook deliveries',
        description: 'List delivery history for a specific webhook subscription',
      },
    }
  )
  .post(
    '/deliveries/:id/retry',
    async ({ db, params, body, set }) => {
      try {
        // Load delivery to verify workspace ownership
        const [delivery] = await db
          .select()
          .from(crmWebhookDeliveries)
          .where(
            and(
              eq(crmWebhookDeliveries.id, params.id),
              eq(crmWebhookDeliveries.workspaceId, body.workspaceId)
            )
          );

        if (!delivery) {
          set.status = 404;
          return { error: 'Delivery not found' };
        }

        // Reset delivery for retry
        await db
          .update(crmWebhookDeliveries)
          .set({
            status: 'pending',
            attemptNumber: delivery.attemptNumber + 1,
            error: null,
            nextRetryAt: null,
          })
          .where(eq(crmWebhookDeliveries.id, params.id));

        // Attempt redelivery
        await webhookDeliveryService.deliverWebhook(db, params.id);

        // Return updated delivery
        const [updated] = await db
          .select()
          .from(crmWebhookDeliveries)
          .where(eq(crmWebhookDeliveries.id, params.id));

        return { delivery: updated };
      } catch (error) {
        console.error('[integrations/deliveries/retry POST] Error:', error);
        set.status = 400;
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to retry delivery',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Retry a webhook delivery',
        description: 'Manually retry a specific failed webhook delivery',
      },
    }
  )
  .get(
    '/delivery-stats',
    async ({ db, query }) => {
      const stats = await webhookDeliveryService.getDeliveryStats(
        db,
        query.workspaceId
      );
      return stats;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Get delivery statistics',
        description:
          'Get overall webhook delivery statistics for a workspace (total, success, failed, pending)',
      },
    }
  )

  // ==========================================================================
  // API Keys
  // ==========================================================================
  .get(
    '/api-keys',
    async ({ db, query }) => {
      const keys = await apiKeyService.listKeys(db, query.workspaceId);
      return { keys };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'List API keys',
        description:
          'List all API keys for a workspace. Key hashes are never returned.',
      },
    }
  )
  .post(
    '/api-keys',
    async ({ db, body, set }) => {
      try {
        const result = await apiKeyService.createKey(db, {
          workspaceId: body.workspaceId,
          name: body.name,
          permissions: body.permissions,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          createdBy: body.createdBy,
        });

        set.status = 201;
        return {
          key: result.key, // Only shown once!
          keyRecord: result.keyRecord,
          warning:
            'Store this API key securely. It will not be shown again.',
        };
      } catch (error) {
        console.error('[integrations/api-keys POST] Error:', error);
        set.status = 400;
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to create API key',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        permissions: t.Optional(t.Array(t.String())),
        expiresAt: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Create API key',
        description:
          'Generate a new API key. The plaintext key is only returned in this response and cannot be retrieved later.',
      },
    }
  )
  .delete(
    '/api-keys/:id',
    async ({ db, params, query, set }) => {
      try {
        await apiKeyService.revokeKey(db, params.id, query.workspaceId);
        return { success: true };
      } catch (error) {
        console.error('[integrations/api-keys DELETE] Error:', error);
        set.status = 404;
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to revoke API key',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Integrations'],
        summary: 'Revoke API key',
        description: 'Revoke (deactivate) an API key. This cannot be undone.',
      },
    }
  );
