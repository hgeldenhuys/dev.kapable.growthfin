/**
 * Research Schema
 * AI-powered contact enrichment and research sessions
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmContacts, crmAccounts } from './crm';

// ============================================================================
// RESEARCH SESSIONS TABLE
// ============================================================================

/**
 * Research Sessions
 * A session represents one AI research run on a contact/account
 */
export const crmResearchSessions = pgTable(
  'crm_research_sessions',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Research target (polymorphic)
    entityType: text('entity_type').notNull(), // 'contact' | 'account'
    entityId: uuid('entity_id').notNull(),

    // Session info
    status: text('status').notNull().default('pending'), // pending|running|completed|failed|stopped
    objective: text('objective').notNull(), // What to research (e.g., "Find company size and funding")
    scope: text('scope').notNull().default('basic'), // basic|deep (affects query count)

    // AI config
    llmConfig: text('llm_config').default('research-assistant'),
    maxQueries: integer('max_queries').default(10),
    budgetCents: integer('budget_cents').default(100), // Cost limit

    // Results
    totalQueries: integer('total_queries').default(0),
    totalFindings: integer('total_findings').default(0),
    costCents: integer('cost_cents').default(0),

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Error tracking
    errorMessage: text('error_message'),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index('idx_crm_research_sessions_workspace_id').on(table.workspaceId),
    entityIdx: index('idx_crm_research_sessions_entity').on(table.entityType, table.entityId),
    statusIdx: index('idx_crm_research_sessions_status').on(table.status),
  })
);

// ============================================================================
// RESEARCH QUERIES TABLE
// ============================================================================

/**
 * Research Queries
 * Individual web searches performed by AI
 */
export const crmResearchQueries = pgTable(
  'crm_research_queries',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    sessionId: uuid('session_id')
      .notNull()
      .references(() => crmResearchSessions.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Query info
    query: text('query').notNull(), // Search query text
    queryType: text('query_type').notNull(), // 'web_search' | 'company_lookup' | 'linkedin_search'

    // Results
    status: text('status').notNull().default('pending'), // pending|completed|failed
    results: jsonb('results'), // Raw search results
    summary: text('summary'), // AI-generated summary of results

    // Timing
    executedAt: timestamp('executed_at', { withTimezone: true }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('idx_crm_research_queries_session_id').on(table.sessionId),
    statusIdx: index('idx_crm_research_queries_status').on(table.status),
  })
);

// ============================================================================
// RESEARCH FINDINGS TABLE
// ============================================================================

/**
 * Research Findings
 * Structured data extracted by AI from search results
 */
export const crmResearchFindings = pgTable(
  'crm_research_findings',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    sessionId: uuid('session_id')
      .notNull()
      .references(() => crmResearchSessions.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Finding info
    field: text('field').notNull(), // Field to update (e.g., 'company_size', 'job_title')
    value: text('value').notNull(), // Proposed value
    confidence: integer('confidence').notNull(), // 0-100
    reasoning: text('reasoning'), // Why AI believes this is correct
    sources: jsonb('sources'), // URLs/citations

    // Review status
    status: text('status').notNull().default('pending'), // pending|approved|rejected
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),

    // Application status
    applied: boolean('applied').default(false),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    appliedBy: uuid('applied_by').references(() => users.id, { onDelete: 'set null' }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('idx_crm_research_findings_session_id').on(table.sessionId),
    statusIdx: index('idx_crm_research_findings_status').on(table.status),
    confidenceIdx: index('idx_crm_research_findings_confidence').on(table.confidence),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmResearchSessionsRelations = relations(crmResearchSessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmResearchSessions.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [crmResearchSessions.createdBy],
    references: [users.id],
  }),
  queries: many(crmResearchQueries),
  findings: many(crmResearchFindings),
}));

export const crmResearchQueriesRelations = relations(crmResearchQueries, ({ one }) => ({
  session: one(crmResearchSessions, {
    fields: [crmResearchQueries.sessionId],
    references: [crmResearchSessions.id],
  }),
  workspace: one(workspaces, {
    fields: [crmResearchQueries.workspaceId],
    references: [workspaces.id],
  }),
}));

export const crmResearchFindingsRelations = relations(crmResearchFindings, ({ one }) => ({
  session: one(crmResearchSessions, {
    fields: [crmResearchFindings.sessionId],
    references: [crmResearchSessions.id],
  }),
  workspace: one(workspaces, {
    fields: [crmResearchFindings.workspaceId],
    references: [workspaces.id],
  }),
  reviewedByUser: one(users, {
    fields: [crmResearchFindings.reviewedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmResearchSession = typeof crmResearchSessions.$inferSelect;
export type NewCrmResearchSession = typeof crmResearchSessions.$inferInsert;

export type CrmResearchQuery = typeof crmResearchQueries.$inferSelect;
export type NewCrmResearchQuery = typeof crmResearchQueries.$inferInsert;

export type CrmResearchFinding = typeof crmResearchFindings.$inferSelect;
export type NewCrmResearchFinding = typeof crmResearchFindings.$inferInsert;
