/**
 * Lead Health Scoring Schema
 * Tracks lead engagement quality, risk factors, and health trends over time
 * Part of Epic 5 Phase 2 - AI-Powered Intelligence (US-LEAD-AI-013)
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { crmLeads } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const healthStatusEnum = pgEnum('health_status', [
  'critical',
  'at_risk',
  'healthy',
  'excellent',
]);

export const healthTrendEnum = pgEnum('health_trend', [
  'improving',
  'stable',
  'declining',
]);

// ============================================================================
// LEAD HEALTH SCORES TABLE
// ============================================================================

export const leadHealthScores = pgTable(
  'lead_health_scores',
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
    healthScore: integer('health_score').notNull(), // 0-100
    healthStatus: healthStatusEnum('health_status').notNull(),
    trend: healthTrendEnum('trend').notNull().default('stable'),

    // Component scores (0-100 each)
    engagementScore: integer('engagement_score'), // How frequently they engage
    responsivenessScore: integer('responsiveness_score'), // How quickly they respond
    activityScore: integer('activity_score'), // Days since last activity
    relationshipScore: integer('relationship_score'), // Length and depth of relationship

    // Factors
    riskFactors: jsonb('risk_factors'), // [{ factor, severity, impact, description }, ...]
    positiveFactors: jsonb('positive_factors'), // [{ factor, impact, description }, ...]

    // Recommendations
    recommendedActions: jsonb('recommended_actions'), // ["immediate_followup", "send_reengagement_email", ...]

    // Timestamps
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    previousScore: integer('previous_score'),
    scoreChangedAt: timestamp('score_changed_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // One health score per lead (latest)
    uniqueLeadHealth: unique('unique_lead_health_score').on(table.leadId),

    // Performance indexes
    workspaceIdx: index('lead_health_scores_workspace_idx').on(table.workspaceId),
    scoreIdx: index('lead_health_scores_score_idx').on(
      table.workspaceId,
      table.healthScore,
      table.calculatedAt
    ),
    statusIdx: index('lead_health_scores_status_idx').on(
      table.workspaceId,
      table.healthStatus,
      table.calculatedAt
    ),
  })
);

// ============================================================================
// HEALTH SCORE HISTORY TABLE
// ============================================================================

export const healthScoreHistory = pgTable(
  'health_score_history',
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
    healthScore: integer('health_score').notNull(),
    healthStatus: healthStatusEnum('health_status').notNull(),

    // Changes
    scoreDelta: integer('score_delta'), // Change from previous day
    statusChanged: boolean('status_changed').default(false),

    // Timestamp
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Performance indexes
    leadIdx: index('health_score_history_lead_idx').on(table.leadId, table.calculatedAt),
    workspaceIdx: index('health_score_history_workspace_idx').on(table.workspaceId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const leadHealthScoresRelations = relations(leadHealthScores, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadHealthScores.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadHealthScores.leadId],
    references: [crmLeads.id],
  }),
}));

export const healthScoreHistoryRelations = relations(healthScoreHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [healthScoreHistory.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [healthScoreHistory.leadId],
    references: [crmLeads.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type LeadHealthScore = typeof leadHealthScores.$inferSelect;
export type NewLeadHealthScore = typeof leadHealthScores.$inferInsert;

export type HealthScoreHistory = typeof healthScoreHistory.$inferSelect;
export type NewHealthScoreHistory = typeof healthScoreHistory.$inferInsert;

export type HealthStatus = 'critical' | 'at_risk' | 'healthy' | 'excellent';
export type HealthTrend = 'improving' | 'stable' | 'declining';
