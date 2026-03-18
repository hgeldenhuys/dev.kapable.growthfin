/**
 * Intent Signals Schema (US-LEAD-AI-012)
 * Track and analyze buying intent signals from lead behavior
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmLeads } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const intentLevelEnum = pgEnum('intent_level', ['low', 'medium', 'high', 'very_high']);

export const intentActionEnum = pgEnum('intent_action', [
  'wait',
  'nurture',
  'immediate_outreach',
  'schedule_demo',
]);

export const signalCategoryEnum = pgEnum('signal_category', [
  'engagement',
  'research',
  'comparison',
  'decision',
]);

// ============================================================================
// INTENT SIGNAL TYPES (Configuration)
// ============================================================================

export const intentSignalTypes = pgTable(
  'intent_signal_types',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Signal definition
    signalType: text('signal_type').notNull(), // e.g., 'pricing_page_visit'
    displayName: text('display_name').notNull(),
    description: text('description'),

    // Scoring
    baseWeight: numeric('base_weight', { precision: 3, scale: 2 })
      .notNull()
      .default('0.50'), // 0-1 scale
    decayRate: numeric('decay_rate', { precision: 3, scale: 2 })
      .notNull()
      .default('0.90'), // How fast signal loses importance (0-1)
    decayPeriodDays: integer('decay_period_days').notNull().default(7),

    // Categorization
    category: signalCategoryEnum('category').notNull().default('engagement'),

    // State
    isActive: boolean('is_active').notNull().default(true),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdx: index('idx_intent_signal_types_workspace').on(table.workspaceId),

    // Unique signal type per workspace
    uniqueSignalType: unique('unique_workspace_signal_type').on(
      table.workspaceId,
      table.signalType
    ),

    // Performance indexes
    categoryIdx: index('idx_intent_signal_types_category').on(table.category),
    isActiveIdx: index('idx_intent_signal_types_active').on(table.isActive),
  })
);

// ============================================================================
// DETECTED INTENT SIGNALS
// ============================================================================

export const intentSignals = pgTable(
  'intent_signals',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Signal details
    signalType: text('signal_type').notNull(),
    signalValue: text('signal_value'), // Additional context (e.g., "enterprise-plan-pricing")

    // Detection
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull().default('manual'), // 'web_tracking', 'email', 'manual', 'enrichment'

    // Metadata
    metadata: jsonb('metadata').notNull().default({}),
    // Example: { "page_url": "...", "duration_seconds": 120, "referrer": "..." }

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdx: index('idx_intent_signals_workspace').on(table.workspaceId),

    // Performance indexes
    leadIdx: index('idx_intent_signals_lead').on(table.leadId, table.detectedAt),
    typeIdx: index('idx_intent_signals_type').on(
      table.workspaceId,
      table.signalType,
      table.detectedAt
    ),
    detectedAtIdx: index('idx_intent_signals_detected_at').on(table.detectedAt),
  })
);

// ============================================================================
// INTENT SCORES (Computed and Cached)
// ============================================================================

export const leadIntentScores = pgTable(
  'lead_intent_scores',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Score
    intentScore: integer('intent_score')
      .notNull()
      .default(0), // 0-100
    intentLevel: intentLevelEnum('intent_level').notNull().default('low'),
    confidence: numeric('confidence', { precision: 3, scale: 2 })
      .notNull()
      .default('0.00'), // 0-1 scale

    // Contributing signals
    signalCount: integer('signal_count').notNull().default(0),
    topSignals: jsonb('top_signals').notNull().default([]),
    // Example: [{ "type": "pricing_page", "weight": 0.8, "detected_at": "..." }, ...]

    // Recommendations
    recommendedAction: intentActionEnum('recommended_action').notNull().default('wait'),
    actionReason: text('action_reason'),

    // Timestamps
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    previousScore: integer('previous_score'), // Track changes
    scoreChangedAt: timestamp('score_changed_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdx: index('idx_lead_intent_scores_workspace').on(table.workspaceId),

    // One score per lead
    uniqueLeadIntentScore: unique('unique_lead_intent_score').on(table.leadId),

    // Performance indexes
    scoreIdx: index('idx_lead_intent_scores_score').on(
      table.workspaceId,
      table.intentScore,
      table.calculatedAt
    ),
    levelIdx: index('idx_lead_intent_scores_level').on(
      table.workspaceId,
      table.intentLevel,
      table.calculatedAt
    ),
    actionIdx: index('idx_lead_intent_scores_action').on(table.recommendedAction),
  })
);

// ============================================================================
// INTENT SCORE HISTORY
// ============================================================================

export const intentScoreHistory = pgTable(
  'intent_score_history',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Score snapshot
    intentScore: integer('intent_score').notNull(),
    intentLevel: intentLevelEnum('intent_level').notNull(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),

    // What changed
    triggerSignalType: text('trigger_signal_type'), // Which signal triggered recalculation
    scoreDelta: integer('score_delta').notNull().default(0), // Change from previous score

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdx: index('idx_intent_score_history_workspace').on(table.workspaceId),

    // Performance indexes
    leadIdx: index('idx_intent_score_history_lead').on(table.leadId, table.calculatedAt),
    scoreIdx: index('idx_intent_score_history_score').on(table.intentScore),
    triggerIdx: index('idx_intent_score_history_trigger').on(table.triggerSignalType),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const intentSignalTypesRelations = relations(intentSignalTypes, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [intentSignalTypes.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [intentSignalTypes.createdBy],
    references: [users.id],
    relationName: 'intentSignalTypeCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [intentSignalTypes.updatedBy],
    references: [users.id],
    relationName: 'intentSignalTypeUpdatedBy',
  }),
}));

export const intentSignalsRelations = relations(intentSignals, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [intentSignals.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [intentSignals.leadId],
    references: [crmLeads.id],
  }),
  createdByUser: one(users, {
    fields: [intentSignals.createdBy],
    references: [users.id],
  }),
}));

export const leadIntentScoresRelations = relations(leadIntentScores, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadIntentScores.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadIntentScores.leadId],
    references: [crmLeads.id],
  }),
}));

export const intentScoreHistoryRelations = relations(intentScoreHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [intentScoreHistory.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [intentScoreHistory.leadId],
    references: [crmLeads.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type IntentSignalType = typeof intentSignalTypes.$inferSelect;
export type NewIntentSignalType = typeof intentSignalTypes.$inferInsert;

export type IntentSignal = typeof intentSignals.$inferSelect;
export type NewIntentSignal = typeof intentSignals.$inferInsert;

export type LeadIntentScore = typeof leadIntentScores.$inferSelect;
export type NewLeadIntentScore = typeof leadIntentScores.$inferInsert;

export type IntentScoreHistory = typeof intentScoreHistory.$inferSelect;
export type NewIntentScoreHistory = typeof intentScoreHistory.$inferInsert;

export type IntentLevel = (typeof intentLevelEnum.enumValues)[number];
export type IntentAction = (typeof intentActionEnum.enumValues)[number];
export type SignalCategory = (typeof signalCategoryEnum.enumValues)[number];
