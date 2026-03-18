/**
 * AI Call Feedback Schema
 * Phase M: AI Call Training/Feedback
 *
 * Tables for call quality feedback and script A/B testing.
 */

import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmAiCalls, crmAiCallScripts } from './ai-voice-calls';

// Predefined feedback tags
export const FEEDBACK_TAGS = [
  'good_opening',
  'poor_opening',
  'clear_objective',
  'unclear_objective',
  'handled_objections',
  'missed_objections',
  'good_closing',
  'poor_closing',
  'got_meeting',
  'missed_opportunity',
  'too_fast',
  'too_slow',
  'natural_conversation',
  'robotic_sounding',
  'good_follow_up',
  'needs_follow_up',
] as const;

export type FeedbackTag = typeof FEEDBACK_TAGS[number];

// AI Call Feedback table
export const crmAiCallFeedback = pgTable('crm_ai_call_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  aiCallId: uuid('ai_call_id').notNull().references(() => crmAiCalls.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  // Feedback content
  rating: integer('rating'), // 1-5 stars
  feedbackText: text('feedback_text'),
  feedbackTags: jsonb('feedback_tags').$type<FeedbackTag[]>().default([]),

  // Audit
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  aiCallIdIdx: index('idx_crm_ai_call_feedback_ai_call_id').on(table.aiCallId),
  workspaceIdIdx: index('idx_crm_ai_call_feedback_workspace_id').on(table.workspaceId),
  ratingIdx: index('idx_crm_ai_call_feedback_rating').on(table.rating),
  createdAtIdx: index('idx_crm_ai_call_feedback_created_at').on(table.createdAt),
}));

// Relations
export const crmAiCallFeedbackRelations = relations(crmAiCallFeedback, ({ one }) => ({
  aiCall: one(crmAiCalls, {
    fields: [crmAiCallFeedback.aiCallId],
    references: [crmAiCalls.id],
  }),
  workspace: one(workspaces, {
    fields: [crmAiCallFeedback.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [crmAiCallFeedback.createdBy],
    references: [users.id],
  }),
}));

// Type exports
export type CrmAiCallFeedback = typeof crmAiCallFeedback.$inferSelect;
export type NewCrmAiCallFeedback = typeof crmAiCallFeedback.$inferInsert;

// Feedback summary type for analytics
export interface FeedbackSummary {
  scriptId: string;
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  tagCounts: Record<FeedbackTag, number>;
  recentFeedback: Array<{
    rating: number | null;
    feedbackText: string | null;
    createdAt: Date;
  }>;
}
