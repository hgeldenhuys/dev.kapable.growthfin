/**
 * Integration Framework Schema (Phase T)
 * Three tables: webhook subscriptions, webhook deliveries, and API keys
 *
 * Supports:
 * - Webhook subscriptions to CRM events (lead.created, deal.won, etc.)
 * - Delivery tracking with retry logic and HMAC signatures
 * - Self-service API key management with SHA-256 hashing
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

// ============================================================================
// WEBHOOK SUBSCRIPTIONS TABLE
// ============================================================================

export const crmWebhookSubscriptions = pgTable(
  'crm_webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Subscription details
    name: text('name').notNull(),
    url: text('url').notNull(),
    secret: text('secret'), // HMAC signing secret for verification
    events: text('events').array().notNull(), // e.g. ['lead.created', 'deal.won']
    isActive: boolean('is_active').notNull().default(true),
    headers: jsonb('headers'), // Custom headers to include in requests
    retryPolicy: jsonb('retry_policy').notNull().default({ maxRetries: 3, backoffMs: 1000 }),
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(60),

    // Audit
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('crm_webhook_sub_workspace_idx').on(table.workspaceId),
    isActiveIdx: index('crm_webhook_sub_active_idx').on(table.isActive),
  })
);

// Relations
export const crmWebhookSubscriptionsRelations = relations(crmWebhookSubscriptions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmWebhookSubscriptions.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [crmWebhookSubscriptions.createdBy],
    references: [users.id],
  }),
  deliveries: many(crmWebhookDeliveries),
}));

// Types
export type CrmWebhookSubscription = typeof crmWebhookSubscriptions.$inferSelect;
export type NewCrmWebhookSubscription = typeof crmWebhookSubscriptions.$inferInsert;

export type RetryPolicy = {
  maxRetries: number;
  backoffMs: number;
};

// ============================================================================
// WEBHOOK DELIVERIES TABLE
// ============================================================================

export const crmWebhookDeliveries = pgTable(
  'crm_webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => crmWebhookSubscriptions.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Event data
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),

    // Delivery status
    status: text('status').notNull(), // 'pending' | 'success' | 'failed' | 'retrying'
    httpStatus: integer('http_status'), // Response HTTP status code
    responseBody: text('response_body'), // Truncated response body
    responseTimeMs: integer('response_time_ms'),

    // Retry tracking
    attemptNumber: integer('attempt_number').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    error: text('error'),

    // Timestamps
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    subscriptionIdx: index('crm_webhook_del_subscription_idx').on(table.subscriptionId),
    workspaceIdx: index('crm_webhook_del_workspace_idx').on(table.workspaceId),
    statusIdx: index('crm_webhook_del_status_idx').on(table.status),
    eventTypeIdx: index('crm_webhook_del_event_type_idx').on(table.eventType),
    createdAtIdx: index('crm_webhook_del_created_at_idx').on(table.createdAt),
  })
);

// Relations
export const crmWebhookDeliveriesRelations = relations(crmWebhookDeliveries, ({ one }) => ({
  subscription: one(crmWebhookSubscriptions, {
    fields: [crmWebhookDeliveries.subscriptionId],
    references: [crmWebhookSubscriptions.id],
  }),
  workspace: one(workspaces, {
    fields: [crmWebhookDeliveries.workspaceId],
    references: [workspaces.id],
  }),
}));

// Types
export type CrmWebhookDelivery = typeof crmWebhookDeliveries.$inferSelect;
export type NewCrmWebhookDelivery = typeof crmWebhookDeliveries.$inferInsert;

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

// ============================================================================
// API KEYS TABLE
// ============================================================================

export const crmApiKeys = pgTable(
  'crm_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Key details
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(), // SHA-256 hash of the actual key
    keyPrefix: text('key_prefix').notNull(), // First 8 chars for identification (e.g., 'agios_ak_')
    permissions: text('permissions').array().notNull().default(['read']),

    // Usage tracking
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),

    // Audit
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('crm_api_keys_workspace_idx').on(table.workspaceId),
    keyHashIdx: uniqueIndex('crm_api_keys_key_hash_idx').on(table.keyHash),
    isActiveIdx: index('crm_api_keys_active_idx').on(table.isActive),
  })
);

// Relations
export const crmApiKeysRelations = relations(crmApiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmApiKeys.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [crmApiKeys.createdBy],
    references: [users.id],
  }),
}));

// Types
export type CrmApiKey = typeof crmApiKeys.$inferSelect;
export type NewCrmApiKey = typeof crmApiKeys.$inferInsert;

export type ApiKeyPermission = 'read' | 'write' | 'admin';
