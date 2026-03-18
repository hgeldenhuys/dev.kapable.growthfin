/**
 * API Usage Monitoring Schema
 * Tracks external API credit balances, usage quotas, and alert thresholds
 * across all providers (Twilio, ElevenLabs, OpenAI, ZeroBounce, etc.)
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  boolean,
  pgEnum,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ============================================================================
// ENUMS
// ============================================================================

export const apiProviderEnum = pgEnum('api_provider', [
  'twilio',
  'elevenlabs',
  'openai',
  'anthropic',
  'zerobounce',
  'rapidapi',
  'brave',
  'perplexity',
  'resend',
  'google_maps',
]);

export const apiTrackingMethodEnum = pgEnum('api_tracking_method', [
  'api',
  'heuristic',
]);

export const apiAlertLevelEnum = pgEnum('api_alert_level', [
  'info',
  'warning',
  'critical',
  'depleted',
]);

// ============================================================================
// API USAGE SNAPSHOTS TABLE
// ============================================================================

export const apiUsageSnapshots = pgTable(
  'api_usage_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    provider: apiProviderEnum('provider').notNull(),
    trackingMethod: apiTrackingMethodEnum('tracking_method').notNull(),

    // Balance-based providers (Twilio USD, ZeroBounce credits)
    balanceRemaining: numeric('balance_remaining', { precision: 15, scale: 4 }),
    balanceUnit: text('balance_unit'), // 'USD', 'credits', 'characters'

    // Quota-based providers (ElevenLabs chars, OpenAI tokens)
    quotaUsed: numeric('quota_used', { precision: 15, scale: 4 }),
    quotaLimit: numeric('quota_limit', { precision: 15, scale: 4 }),
    quotaUnit: text('quota_unit'), // 'characters', 'tokens', 'requests'
    quotaResetAt: timestamp('quota_reset_at', { withTimezone: true }),

    // Heuristic tracking (local call counts)
    callCountPeriod: integer('call_count_period'), // calls in last 30 days
    estimatedCostPeriod: numeric('estimated_cost_period', { precision: 15, scale: 6 }),

    // Computed usage percentage (0-100, null if no limit known)
    usagePercent: numeric('usage_percent', { precision: 5, scale: 2 }),

    // Provider health
    isReachable: boolean('is_reachable').notNull().default(true),
    lastError: text('last_error'),
    latencyMs: integer('latency_ms'),

    // Raw API response for debugging
    rawResponse: jsonb('raw_response'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('api_usage_snapshots_provider_idx').on(table.provider),
    createdAtIdx: index('api_usage_snapshots_created_at_idx').on(table.createdAt),
    providerCreatedIdx: index('api_usage_snapshots_provider_created_idx').on(
      table.provider,
      table.createdAt
    ),
  })
);

// ============================================================================
// API USAGE ALERTS TABLE
// ============================================================================

export const apiUsageAlerts = pgTable(
  'api_usage_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    provider: apiProviderEnum('provider').notNull(),
    alertLevel: apiAlertLevelEnum('alert_level').notNull(),
    message: text('message').notNull(),

    // Resolution tracking
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Notification tracking
    discordSent: boolean('discord_sent').notNull().default(false),
    emailSent: boolean('email_sent').notNull().default(false),

    // Link to triggering snapshot
    snapshotId: uuid('snapshot_id').references(() => apiUsageSnapshots.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('api_usage_alerts_provider_idx').on(table.provider),
    alertLevelIdx: index('api_usage_alerts_level_idx').on(table.alertLevel),
    unresolvedIdx: index('api_usage_alerts_unresolved_idx').on(
      table.provider,
      table.alertLevel,
      table.resolvedAt
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const apiUsageSnapshotsRelations = relations(apiUsageSnapshots, ({ many }) => ({
  alerts: many(apiUsageAlerts),
}));

export const apiUsageAlertsRelations = relations(apiUsageAlerts, ({ one }) => ({
  snapshot: one(apiUsageSnapshots, {
    fields: [apiUsageAlerts.snapshotId],
    references: [apiUsageSnapshots.id],
  }),
  acknowledger: one(users, {
    fields: [apiUsageAlerts.acknowledgedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type ApiUsageSnapshot = typeof apiUsageSnapshots.$inferSelect;
export type NewApiUsageSnapshot = typeof apiUsageSnapshots.$inferInsert;

export type ApiUsageAlert = typeof apiUsageAlerts.$inferSelect;
export type NewApiUsageAlert = typeof apiUsageAlerts.$inferInsert;

export type ApiProvider =
  | 'twilio'
  | 'elevenlabs'
  | 'openai'
  | 'anthropic'
  | 'zerobounce'
  | 'rapidapi'
  | 'brave'
  | 'perplexity'
  | 'resend'
  | 'google_maps';

export type ApiTrackingMethod = 'api' | 'heuristic';
export type ApiAlertLevel = 'info' | 'warning' | 'critical' | 'depleted';
