/**
 * AI Voice Campaigns Schema
 * Phase N: Campaign AI Calling
 *
 * Tables for AI voice rate limiting and call queue.
 */

import { pgTable, uuid, text, integer, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { crmCampaigns, crmCampaignRecipients } from './campaigns';
import { crmAiCalls, crmAiCallScripts } from './ai-voice-calls';

// AI Voice Rate Limits table
export const crmAiVoiceRateLimits = pgTable('crm_ai_voice_rate_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  windowStart: timestamp('window_start').notNull(),
  windowType: text('window_type').notNull().$type<'hour' | 'day'>(),
  callCount: integer('call_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('idx_crm_ai_voice_rate_limits_workspace_id').on(table.workspaceId),
  windowIdx: index('idx_crm_ai_voice_rate_limits_window').on(table.workspaceId, table.windowStart, table.windowType),
  uniqueWindow: unique().on(table.workspaceId, table.windowStart, table.windowType),
}));

// Queue status enum
export type AiVoiceQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'scheduled';

// AI Voice Queue table
export const crmAiVoiceQueue = pgTable('crm_ai_voice_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => crmCampaigns.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').references(() => crmCampaignRecipients.id, { onDelete: 'cascade' }),

  // Call configuration
  aiScriptId: uuid('ai_script_id').references(() => crmAiCallScripts.id),
  toNumber: text('to_number').notNull(),
  leadId: uuid('lead_id'),
  contactId: uuid('contact_id'),

  // Queue state
  status: text('status').notNull().default('pending').$type<AiVoiceQueueStatus>(),
  priority: integer('priority').default(0),

  // Retry tracking
  attemptCount: integer('attempt_count').default(0),
  maxAttempts: integer('max_attempts').default(3),
  nextAttemptAt: timestamp('next_attempt_at'),
  lastError: text('last_error'),

  // Call result
  aiCallId: uuid('ai_call_id').references(() => crmAiCalls.id),
  callOutcome: text('call_outcome').$type<'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed'>(),

  // Scheduling
  scheduledAt: timestamp('scheduled_at'),
  preferredHoursStart: text('preferred_hours_start'), // "09:00"
  preferredHoursEnd: text('preferred_hours_end'),     // "17:00"
  timezone: text('timezone').default('UTC'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  workspaceIdIdx: index('idx_crm_ai_voice_queue_workspace_id').on(table.workspaceId),
  campaignIdIdx: index('idx_crm_ai_voice_queue_campaign_id').on(table.campaignId),
  statusIdx: index('idx_crm_ai_voice_queue_status').on(table.status),
  nextAttemptIdx: index('idx_crm_ai_voice_queue_next_attempt').on(table.nextAttemptAt),
}));

// AI Voice Call Config type for campaign messages
export interface AiCallConfig {
  maxAttempts?: number;         // Default: 3
  retryDelayMinutes?: number;   // Default: 30
  preferredHours?: string;      // "09:00-17:00"
  timezone?: string;            // Default: "UTC"
  concurrentCalls?: number;     // Default: 1
}

// Default AI voice settings
export const AI_VOICE_DEFAULTS: Required<AiCallConfig> = {
  maxAttempts: 3,
  retryDelayMinutes: 30,
  preferredHours: '09:00-18:00',
  timezone: 'UTC',
  concurrentCalls: 1,
};

// Relations
export const crmAiVoiceRateLimitsRelations = relations(crmAiVoiceRateLimits, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmAiVoiceRateLimits.workspaceId],
    references: [workspaces.id],
  }),
}));

export const crmAiVoiceQueueRelations = relations(crmAiVoiceQueue, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmAiVoiceQueue.workspaceId],
    references: [workspaces.id],
  }),
  campaign: one(crmCampaigns, {
    fields: [crmAiVoiceQueue.campaignId],
    references: [crmCampaigns.id],
  }),
  recipient: one(crmCampaignRecipients, {
    fields: [crmAiVoiceQueue.recipientId],
    references: [crmCampaignRecipients.id],
  }),
  script: one(crmAiCallScripts, {
    fields: [crmAiVoiceQueue.aiScriptId],
    references: [crmAiCallScripts.id],
  }),
  aiCall: one(crmAiCalls, {
    fields: [crmAiVoiceQueue.aiCallId],
    references: [crmAiCalls.id],
  }),
}));

// Type exports
export type CrmAiVoiceRateLimit = typeof crmAiVoiceRateLimits.$inferSelect;
export type NewCrmAiVoiceRateLimit = typeof crmAiVoiceRateLimits.$inferInsert;

export type CrmAiVoiceQueue = typeof crmAiVoiceQueue.$inferSelect;
export type NewCrmAiVoiceQueue = typeof crmAiVoiceQueue.$inferInsert;
