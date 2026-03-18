/**
 * Email Suppressions Schema (Phase P)
 * Track suppressed email addresses per workspace to protect sender reputation
 *
 * Addresses are suppressed due to:
 * - Hard bounces (permanent delivery failure)
 * - Spam complaints (recipient marked as spam)
 * - Manual unsubscribe (one-click unsubscribe link)
 * - Soft bounce conversion (after N retries)
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';

// ============================================================================
// EMAIL SUPPRESSIONS TABLE
// ============================================================================

export const crmEmailSuppressions = pgTable(
  'crm_email_suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Suppressed email address (lowercased)
    email: text('email').notNull(),

    // Suppression reason
    reason: text('reason').notNull(), // hard_bounce | soft_bounce_converted | spam_complaint | manual_unsubscribe | admin_suppressed
    reasonDetail: text('reason_detail'), // Detailed reason (e.g., bounce description from Resend)

    // Source tracking
    sourceType: text('source_type').notNull(), // webhook | unsubscribe_link | admin | import
    sourceCampaignId: uuid('source_campaign_id'), // Campaign that caused the suppression (if applicable)
    sourceRecipientId: uuid('source_recipient_id'), // Recipient record that caused the suppression (if applicable)

    // Soft bounce tracking (before conversion to hard suppression)
    softBounceCount: integer('soft_bounce_count').notNull().default(0),
    lastSoftBounceAt: timestamp('last_soft_bounce_at', { withTimezone: true }),

    // Reactivation support
    isActive: boolean('is_active').notNull().default(true), // Can be reactivated by admin
    reactivatedAt: timestamp('reactivated_at', { withTimezone: true }),
    reactivatedBy: uuid('reactivated_by'),

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Unique: one active suppression per email per workspace
    workspaceEmailIdx: uniqueIndex('crm_email_supp_workspace_email_idx').on(
      table.workspaceId,
      table.email
    ),
    // Index for workspace lookups
    workspaceIdx: index('crm_email_supp_workspace_idx').on(table.workspaceId),
    // Index for reason-based queries
    reasonIdx: index('crm_email_supp_reason_idx').on(table.reason),
    // Index for active suppressions
    isActiveIdx: index('crm_email_supp_active_idx').on(table.isActive),
    // Index for campaign-based lookups
    campaignIdx: index('crm_email_supp_campaign_idx').on(table.sourceCampaignId),
  })
);

// Relations
export const crmEmailSuppressionsRelations = relations(crmEmailSuppressions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmEmailSuppressions.workspaceId],
    references: [workspaces.id],
  }),
}));

// Types
export type CrmEmailSuppression = typeof crmEmailSuppressions.$inferSelect;
export type NewCrmEmailSuppression = typeof crmEmailSuppressions.$inferInsert;

export type SuppressionReason =
  | 'hard_bounce'
  | 'soft_bounce_converted'
  | 'spam_complaint'
  | 'manual_unsubscribe'
  | 'admin_suppressed';

export type SuppressionSourceType =
  | 'webhook'
  | 'unsubscribe_link'
  | 'admin'
  | 'import';

// ============================================================================
// EMAIL RATE LIMITS TABLE (follows SMS rate limits pattern)
// ============================================================================

export const crmEmailRateLimits = pgTable(
  'crm_email_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowType: text('window_type').notNull(), // 'minute' | 'hour' | 'day'
    sentCount: integer('sent_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: one record per workspace per window start per window type
    workspaceWindowIdx: uniqueIndex('crm_email_rate_workspace_window_idx').on(
      table.workspaceId,
      table.windowStart,
      table.windowType
    ),
    // Index for cleanup queries
    windowStartIdx: index('crm_email_rate_window_start_idx').on(table.windowStart),
    // Index for workspace lookups
    workspaceIdx: index('crm_email_rate_workspace_idx').on(table.workspaceId),
  })
);

// Relations
export const crmEmailRateLimitsRelations = relations(crmEmailRateLimits, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmEmailRateLimits.workspaceId],
    references: [workspaces.id],
  }),
}));

// Types
export type CrmEmailRateLimit = typeof crmEmailRateLimits.$inferSelect;
export type NewCrmEmailRateLimit = typeof crmEmailRateLimits.$inferInsert;
