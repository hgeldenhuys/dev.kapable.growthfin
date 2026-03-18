/**
 * Advanced Automation Schema (Phase U)
 * Human-in-the-loop workflow approvals and automated lead routing rules.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

// ============================================================================
// WORKFLOW APPROVALS TABLE
// ============================================================================

export const crmWorkflowApprovals = pgTable(
  'crm_workflow_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Workflow reference (conceptually references campaign_workflows)
    workflowId: uuid('workflow_id').notNull(),

    // Enrollment waiting for approval
    enrollmentId: uuid('enrollment_id'),

    // Step within the workflow
    stepId: text('step_id').notNull(),
    stepName: text('step_name'),

    // Entity being processed
    entityType: text('entity_type').notNull(), // 'lead' | 'contact' | 'opportunity'
    entityId: uuid('entity_id').notNull(),
    entityName: text('entity_name'),

    // Request timing
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),

    // Decision
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'expired'
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNotes: text('decision_notes'),

    // Expiration
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('crm_workflow_approvals_workspace_idx').on(table.workspaceId),
    statusIdx: index('crm_workflow_approvals_status_idx').on(table.status),
    workflowIdx: index('crm_workflow_approvals_workflow_idx').on(table.workflowId),
  })
);

// ============================================================================
// LEAD ROUTING RULES TABLE
// ============================================================================

export const crmLeadRoutingRules = pgTable(
  'crm_lead_routing_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Rule metadata
    name: text('name').notNull(),
    description: text('description'),
    priority: integer('priority').notNull().default(0), // higher = evaluated first

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Conditions (JSON rule engine)
    // e.g., { field: 'leadSource', operator: 'equals', value: 'website' }
    conditions: jsonb('conditions').notNull(),

    // Assignment target
    assignToUserId: uuid('assign_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    assignToTeam: text('assign_to_team'),

    // Round-robin distribution
    roundRobin: boolean('round_robin').notNull().default(false),
    roundRobinState: jsonb('round_robin_state'), // tracks last assigned user index

    // Statistics
    matchCount: integer('match_count').notNull().default(0),
    lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }),

    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('crm_lead_routing_rules_workspace_idx').on(table.workspaceId),
    isActiveIdx: index('crm_lead_routing_rules_active_idx').on(table.isActive),
    priorityIdx: index('crm_lead_routing_rules_priority_idx').on(table.priority),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmWorkflowApprovalsRelations = relations(crmWorkflowApprovals, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmWorkflowApprovals.workspaceId],
    references: [workspaces.id],
  }),
  decidedByUser: one(users, {
    fields: [crmWorkflowApprovals.decidedBy],
    references: [users.id],
  }),
}));

export const crmLeadRoutingRulesRelations = relations(crmLeadRoutingRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmLeadRoutingRules.workspaceId],
    references: [workspaces.id],
  }),
  assignedUser: one(users, {
    fields: [crmLeadRoutingRules.assignToUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [crmLeadRoutingRules.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmWorkflowApproval = typeof crmWorkflowApprovals.$inferSelect;
export type NewCrmWorkflowApproval = typeof crmWorkflowApprovals.$inferInsert;

export type CrmLeadRoutingRule = typeof crmLeadRoutingRules.$inferSelect;
export type NewCrmLeadRoutingRule = typeof crmLeadRoutingRules.$inferInsert;

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RoutingEntityType = 'lead' | 'contact' | 'opportunity';
