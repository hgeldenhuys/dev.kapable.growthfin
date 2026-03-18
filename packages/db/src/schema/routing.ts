/**
 * Lead Routing Schema (US-LEAD-AI-011)
 * Automated lead routing with agent profiles, routing rules, and performance tracking
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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmLeads } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const availabilityStatusEnum = pgEnum('availability_status', [
  'available',
  'busy',
  'unavailable',
  'offline',
]);

export const routingStrategyEnum = pgEnum('routing_strategy', [
  'balanced',
  'skill_match',
  'round_robin',
  'predictive',
  'rule_based',
]);

// ============================================================================
// AGENT PROFILES TABLE
// ============================================================================

export const agentProfiles = pgTable(
  'agent_profiles',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Skills and specialization
    skills: text('skills').array(), // ['enterprise', 'technical', 'smb', 'healthcare']
    industries: text('industries').array(), // ['technology', 'healthcare', 'finance']
    languages: text('languages').array(), // ['en', 'es', 'fr']

    // Capacity and availability
    maxConcurrentLeads: integer('max_concurrent_leads').notNull().default(50),
    currentLeadCount: integer('current_lead_count').notNull().default(0),
    availabilityStatus: availabilityStatusEnum('availability_status').notNull().default('available'),
    timezone: text('timezone'),
    workingHours: jsonb('working_hours'), // { "monday": ["09:00-17:00"], "tuesday": [...] }

    // Performance metrics
    avgResponseTimeMinutes: integer('avg_response_time_minutes'),
    conversionRate: numeric('conversion_rate', { precision: 5, scale: 4 }), // 0-1
    satisfactionScore: numeric('satisfaction_score', { precision: 3, scale: 2 }), // 0-5

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: one profile per user per workspace
    uniqueAgentProfile: index('idx_agent_profile_unique').on(table.workspaceId, table.userId),

    // Query optimization: find available agents with capacity
    capacityIdx: index('idx_agent_profiles_capacity').on(
      table.workspaceId,
      table.availabilityStatus,
      table.currentLeadCount
    ),
  })
);

// ============================================================================
// LEAD ROUTING HISTORY TABLE
// ============================================================================

export const leadRoutingHistory = pgTable(
  'lead_routing_history',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Assignment details
    fromAgentId: uuid('from_agent_id').references(() => users.id),
    toAgentId: uuid('to_agent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Routing algorithm
    routingStrategy: routingStrategyEnum('routing_strategy').notNull(),
    routingScore: numeric('routing_score', { precision: 5, scale: 4 }), // 0-1 confidence
    routingReason: text('routing_reason'), // Human-readable explanation

    // Context at time of routing (JSONB snapshots)
    agentWorkloadSnapshot: jsonb('agent_workload_snapshot'),
    // { "current_leads": 12, "max_leads": 50, "availability": "available" }

    leadScoreSnapshot: jsonb('lead_score_snapshot'),
    // { "conversion_score": 85, "enrichment_complete": true }

    // Result tracking
    routedAt: timestamp('routed_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    wasManualOverride: boolean('was_manual_override').notNull().default(false),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Query by lead (get routing history for lead)
    leadIdx: index('idx_lead_routing_history_lead').on(table.leadId, table.routedAt),

    // Query by agent (get assignments for agent)
    agentIdx: index('idx_lead_routing_history_agent').on(table.toAgentId, table.routedAt),

    // Query by workspace
    workspaceIdx: index('idx_lead_routing_history_workspace').on(table.workspaceId),
  })
);

// ============================================================================
// ROUTING RULES TABLE
// ============================================================================

export const routingRules = pgTable(
  'routing_rules',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Rule metadata
    name: text('name').notNull(),
    description: text('description'),
    priority: integer('priority').notNull().default(0), // Higher = evaluated first

    // Condition (JSONB query format like segments)
    conditions: jsonb('conditions').notNull(),
    // { "operator": "AND", "conditions": [{ "field": "industry", "operator": "equals", "value": "tech" }] }

    // Actions
    assignToAgentId: uuid('assign_to_agent_id').references(() => users.id),
    assignToTeam: text('assign_to_team'), // 'enterprise', 'smb', 'technical'
    routingStrategy: routingStrategyEnum('routing_strategy'), // Override default strategy

    // State
    isActive: boolean('is_active').notNull().default(true),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    // Query active rules by priority
    activeRulesIdx: index('idx_routing_rules_active').on(
      table.workspaceId,
      table.priority,
      table.isActive
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const agentProfilesRelations = relations(agentProfiles, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentProfiles.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [agentProfiles.userId],
    references: [users.id],
  }),
}));

export const leadRoutingHistoryRelations = relations(leadRoutingHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadRoutingHistory.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadRoutingHistory.leadId],
    references: [crmLeads.id],
  }),
  fromAgent: one(users, {
    fields: [leadRoutingHistory.fromAgentId],
    references: [users.id],
  }),
  toAgent: one(users, {
    fields: [leadRoutingHistory.toAgentId],
    references: [users.id],
  }),
}));

export const routingRulesRelations = relations(routingRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [routingRules.workspaceId],
    references: [workspaces.id],
  }),
  assignedAgent: one(users, {
    fields: [routingRules.assignToAgentId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [routingRules.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type AgentProfile = typeof agentProfiles.$inferSelect;
export type NewAgentProfile = typeof agentProfiles.$inferInsert;

export type LeadRoutingHistory = typeof leadRoutingHistory.$inferSelect;
export type NewLeadRoutingHistory = typeof leadRoutingHistory.$inferInsert;

export type RoutingRule = typeof routingRules.$inferSelect;
export type NewRoutingRule = typeof routingRules.$inferInsert;

export type AvailabilityStatus = typeof availabilityStatusEnum.enumValues[number];
export type RoutingStrategy = typeof routingStrategyEnum.enumValues[number];
