/**
 * SMS Rate Limits Schema (Phase H.3)
 * Track SMS sending rate limits per workspace for bulk SMS campaigns
 */

import {
  pgTable,
  uuid,
  timestamp,
  integer,
  text,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';

/**
 * SMS Rate Limits
 * Track SMS send counts per workspace per time window
 *
 * Supports multiple window types:
 * - 'minute' - Per-minute limits (e.g., 60/min)
 * - 'hour' - Per-hour limits (e.g., 1000/hr)
 * - 'day' - Per-day limits (e.g., 10000/day)
 */
export const crmSmsRateLimits = pgTable(
  'crm_sms_rate_limits',
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
    workspaceWindowIdx: uniqueIndex('crm_sms_rate_workspace_window_idx').on(
      table.workspaceId,
      table.windowStart,
      table.windowType
    ),
    // Index for cleanup queries
    windowStartIdx: index('crm_sms_rate_window_start_idx').on(table.windowStart),
    // Index for workspace lookups
    workspaceIdx: index('crm_sms_rate_workspace_idx').on(table.workspaceId),
  })
);

// Relations
export const crmSmsRateLimitsRelations = relations(crmSmsRateLimits, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmSmsRateLimits.workspaceId],
    references: [workspaces.id],
  }),
}));

// Types
export type CrmSmsRateLimit = typeof crmSmsRateLimits.$inferSelect;
export type NewCrmSmsRateLimit = typeof crmSmsRateLimits.$inferInsert;
