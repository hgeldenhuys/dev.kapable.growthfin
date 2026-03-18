/**
 * CRM Schema
 * Customer Relationship Management tables for contacts, accounts, leads, opportunities, activities, and timeline
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
import { crmContactLists } from './contact-lists';

export * from './workspaces';
export * from './users';

// ============================================================================
// ENUMS
// ============================================================================

export const contactStatusEnum = pgEnum('crm_contact_status', [
  'active',
  'inactive',
  'do_not_contact',
]);

/**
 * Contact Lifecycle Stages (Marketing-Focused)
 *
 * Purpose: Track marketing progression for contacts in crm_contacts table
 *
 * Stages:
 * - raw: Imported, unverified contact (default)
 * - verified: Phone/email verified, marketing consent established
 * - engaged: High engagement score, sales-ready (can spawn crm_leads record)
 * - customer: Paying customer, post-conversion
 *
 * Note: This is separate from crm_leads.status (sales progression)
 *
 * Migration 0061: Renamed 'lead'→'verified' and 'qualified'→'engaged'
 * to avoid confusion with crm_leads table
 */
export const lifecycleStageEnum = pgEnum('crm_lifecycle_stage', [
  'raw',
  'verified',  // was 'lead' (deprecated)
  'engaged',   // was 'qualified' (deprecated)
  'customer',
  // Legacy values (deprecated, do not use):
  'lead',      // use 'verified' instead
  'qualified', // use 'engaged' instead
]);

export const leadStatusEnum = pgEnum('crm_lead_status', [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'do_not_contact', // TCPA/GDPR compliance - lead opted out of communications
]);

export const opportunityStageEnum = pgEnum('crm_opportunity_stage', [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

export const opportunityStatusEnum = pgEnum('crm_opportunity_status', [
  'open',
  'won',
  'lost',
]);

// Migration: ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'whatsapp';
export const activityTypeEnum = pgEnum('crm_activity_type', [
  'call',
  'email',
  'sms',
  'whatsapp',
  'meeting',
  'task',
  'note',
]);

export const activityStatusEnum = pgEnum('crm_activity_status', [
  'planned',
  'completed',
  'cancelled',
]);

export const activityPriorityEnum = pgEnum('crm_activity_priority', [
  'low',
  'medium',
  'high',
]);

export const timelineEntityTypeEnum = pgEnum('crm_timeline_entity_type', [
  'contact',
  'account',
  'lead',
  'opportunity',
]);

export const timelineEventCategoryEnum = pgEnum('crm_timeline_event_category', [
  'communication',
  'milestone',
  'data',
  'system',
  'compliance',
]);

export const timelineActorTypeEnum = pgEnum('crm_timeline_actor_type', [
  'user',
  'system',
  'integration',
]);

export const crmImportStatusEnum = pgEnum('crm_import_status', [
  'validating',
  'importing',
  'completed',
  'failed',
]);

// ============================================================================
// CRM STATE MACHINE ENUMS (US-CRM-STATE-MACHINE)
// ============================================================================

/**
 * Lead Contactability States (T-001)
 * Tracks contact attempt outcomes and progression
 */
export const leadContactabilityEnum = pgEnum('crm_lead_contactability', [
  'new',
  'contact_attempted',
  'no_party_contact',
  'wrong_party_contact',
  'right_party_contact',
  'blacklisted',
  'do_not_contact',
  'converted',
]);

/**
 * Blacklist Reasons (T-002)
 * Why a lead was blacklisted (internal business decision)
 */
export const blacklistReasonEnum = pgEnum('crm_blacklist_reason', [
  'max_contact_attempts',
  'wrong_party',
  'unqualified',
  'competitor',
  'bad_data',
  'duplicate',
  'requested',
  'fraud',
  'other',
]);

/**
 * Contact Disposition States (T-003)
 * Replaces simple status with richer disposition tracking
 */
export const contactDispositionEnum = pgEnum('crm_contact_disposition', [
  'new',
  'callback',
  'interested',
  'not_interested',
  'do_not_contact',
]);

/**
 * Opportunity Outcome (T-004)
 * Terminal state for opportunities
 */
export const opportunityOutcomeEnum = pgEnum('crm_opportunity_outcome', [
  'open',
  'won',
  'lost',
]);

/**
 * Lost Reasons (T-004)
 * Why an opportunity was lost
 */
export const lostReasonEnum = pgEnum('crm_lost_reason', [
  'price',
  'timing',
  'competitor',
  'no_budget',
  'no_decision',
  'feature_gap',
  'went_silent',
  'internal_solution',
  'other',
]);

// ============================================================================
// ACCOUNTS TABLE
// ============================================================================

export const crmAccounts = pgTable(
  'crm_accounts',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    name: text('name').notNull(),
    industry: text('industry'),
    employeeCount: integer('employee_count'),
    annualRevenue: numeric('annual_revenue', { precision: 15, scale: 2 }),
    website: text('website'),

    // Billing Address
    billingAddressLine1: text('billing_address_line1'),
    billingAddressLine2: text('billing_address_line2'),
    billingCity: text('billing_city'),
    billingStateProvince: text('billing_state_province'),
    billingPostalCode: text('billing_postal_code'),
    billingCountry: text('billing_country'),

    // Shipping Address
    shippingAddressLine1: text('shipping_address_line1'),
    shippingAddressLine2: text('shipping_address_line2'),
    shippingCity: text('shipping_city'),
    shippingStateProvince: text('shipping_state_province'),
    shippingPostalCode: text('shipping_postal_code'),
    shippingCountry: text('shipping_country'),

    // Hierarchy
    parentAccountId: uuid('parent_account_id'), // Self-referencing for account hierarchy

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Scoring
    healthScore: integer('health_score').notNull().default(50), // 0-100
    healthScoreUpdatedAt: timestamp('health_score_updated_at', { withTimezone: true }),

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    customFields: jsonb('custom_fields').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_accounts_workspace_id').on(table.workspaceId),
    ownerIdIdx: index('idx_crm_accounts_owner_id').on(table.ownerId),
    parentAccountIdIdx: index('idx_crm_accounts_parent_account_id').on(table.parentAccountId),
    healthScoreIdx: index('idx_crm_accounts_health_score').on(table.workspaceId, table.healthScore),
    billingCityIdx: index('idx_accounts_billing_city').on(table.workspaceId, table.billingCity),
    billingStateIdx: index('idx_accounts_billing_state').on(table.workspaceId, table.billingStateProvince),
    billingCountryIdx: index('idx_accounts_billing_country').on(table.workspaceId, table.billingCountry),
  })
);

// ============================================================================
// CONTACTS TABLE
// ============================================================================

export const crmContacts = pgTable(
  'crm_contacts',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    emailSecondary: text('email_secondary'),
    phone: text('phone'),
    phoneSecondary: text('phone_secondary'),
    mobile: text('mobile'),
    title: text('title'),
    department: text('department'),

    // Account relationship
    accountId: uuid('account_id').references(() => crmAccounts.id, { onDelete: 'set null' }),

    // Lead conversion tracking
    convertedFromLeadId: uuid('converted_from_lead_id').references(() => crmLeads.id, { onDelete: 'set null' }),

    // Status and lifecycle
    status: contactStatusEnum('status').notNull().default('active'),
    lifecycleStage: lifecycleStageEnum('lifecycle_stage').notNull().default('raw'),

    // Disposition (US-CRM-STATE-MACHINE T-007)
    disposition: contactDispositionEnum('disposition').default('new').notNull(),
    dispositionChangedAt: timestamp('disposition_changed_at', { withTimezone: true }),
    dispositionChangedBy: uuid('disposition_changed_by'),

    // Callback tracking (US-CRM-STATE-MACHINE T-007)
    callbackDate: timestamp('callback_date', { withTimezone: true }),
    callbackNotes: text('callback_notes'),

    // Opportunity conversion tracking (US-CRM-STATE-MACHINE T-007)
    convertedToOpportunityId: uuid('converted_to_opportunity_id'),
    convertedToOpportunityAt: timestamp('converted_to_opportunity_at', { withTimezone: true }),

    // Scoring
    leadScore: integer('lead_score').notNull().default(0), // 0-100
    engagementScore: integer('engagement_score').notNull().default(0), // 0-100

    // Source
    leadSource: text('lead_source'),

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Compliance (GDPR/POPIA)
    consentMarketing: boolean('consent_marketing').notNull().default(false),
    consentMarketingDate: timestamp('consent_marketing_date', { withTimezone: true }),
    consentMarketingVersion: text('consent_marketing_version'),
    consentTransactional: boolean('consent_transactional').notNull().default(false),
    consentTransactionalDate: timestamp('consent_transactional_date', { withTimezone: true }),

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    customFields: jsonb('custom_fields').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_contacts_workspace_id').on(table.workspaceId),
    emailIdx: index('idx_crm_contacts_email').on(table.email),
    phoneIdx: index('idx_crm_contacts_phone').on(table.phone),
    accountIdIdx: index('idx_crm_contacts_account_id').on(table.accountId),
    ownerIdIdx: index('idx_crm_contacts_owner_id').on(table.ownerId),
    lifecycleStageIdx: index('idx_crm_contacts_lifecycle_stage').on(table.lifecycleStage),
  })
);

// ============================================================================
// LEADS TABLE
// ============================================================================

export const crmLeads = pgTable(
  'crm_leads',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    companyName: text('company_name').notNull(),
    email: text('email'),
    phone: text('phone'),

    // Address
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    stateProvince: text('state_province'),
    postalCode: text('postal_code'),
    country: text('country'),

    // Status
    status: leadStatusEnum('status').notNull().default('new'),
    source: text('source').notNull(),

    // Scoring and qualification
    leadScore: integer('lead_score').notNull().default(0), // 0-100
    effectiveLeadScore: integer('effective_lead_score').notNull().default(0), // Confidence-adjusted score
    estimatedValue: numeric('estimated_value', { precision: 15, scale: 2 }),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),

    // BANT Qualification (US-CRM-STATE-MACHINE T-006)
    // NOTE: Production DB uses text type for free-form BANT notes, not boolean
    bantBudget: text('bant_budget'),
    bantAuthority: text('bant_authority'),
    bantNeed: text('bant_need'),
    bantTiming: text('bant_timing'),
    qualificationScore: integer('qualification_score'), // 0-100, manual or auto
    qualificationSource: text('qualification_source'), // 'auto' | 'manual'
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    qualifiedBy: uuid('qualified_by'), // user who qualified
    qualificationNotes: text('qualification_notes'),

    // Agent workflow fields
    callbackDate: timestamp('callback_date', { withTimezone: true }),
    lastContactDate: timestamp('last_contact_date', { withTimezone: true }),

    // Contactability tracking (US-CRM-STATE-MACHINE T-005)
    contactability: leadContactabilityEnum('contactability').default('new').notNull(),
    contactAttempts: integer('contact_attempts').default(0).notNull(),
    lastContactAttempt: timestamp('last_contact_attempt', { withTimezone: true }),
    lastContactOutcome: text('last_contact_outcome'), // JSON storing detailed outcome

    // Blacklist tracking (US-CRM-STATE-MACHINE T-005)
    blacklistedAt: timestamp('blacklisted_at', { withTimezone: true }),
    blacklistReason: blacklistReasonEnum('blacklist_reason'),
    blacklistNotes: text('blacklist_notes'),

    // Propensity scoring (AI-powered lead prioritization)
    propensityScore: integer('propensity_score').notNull().default(0),
    propensityScoreUpdatedAt: timestamp('propensity_score_updated_at', { withTimezone: true }),
    scoreBreakdown: jsonb('score_breakdown').notNull().default({}),

    // Campaign tracking (nullable - leads may not always come from campaigns)
    campaignId: uuid('campaign_id'), // References crm_campaigns.id

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Conversion tracking
    convertedContactId: uuid('converted_contact_id').references(() => crmContacts.id, {
      onDelete: 'set null',
    }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    customFields: jsonb('custom_fields').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_leads_workspace_id').on(table.workspaceId),
    statusIdx: index('idx_crm_leads_status').on(table.status),
    ownerIdIdx: index('idx_crm_leads_owner_id').on(table.ownerId),
    convertedContactIdIdx: index('idx_crm_leads_converted_contact_id').on(
      table.convertedContactId
    ),
    // Agent call list index (composite for priority sorting)
    agentCallListIdx: index('idx_crm_leads_agent_list').on(
      table.workspaceId,
      table.ownerId,
      table.status,
      table.callbackDate
    ),
    // Propensity score index for AI-powered call list sorting
    propensityScoreIdx: index('idx_crm_leads_propensity_score').on(
      table.workspaceId,
      table.propensityScore
    ),
    // Effective lead score index for campaign queries (confidence-adjusted)
    effectiveScoreIdx: index('idx_crm_leads_effective_score').on(
      table.workspaceId,
      table.effectiveLeadScore
    ),
    campaignIdIdx: index('idx_crm_leads_campaign_id').on(table.campaignId),
    // Location-based filtering indexes
    cityIdx: index('idx_leads_city').on(table.workspaceId, table.city),
    stateIdx: index('idx_leads_state').on(table.workspaceId, table.stateProvince),
    countryIdx: index('idx_leads_country').on(table.workspaceId, table.country),
  })
);

// ============================================================================
// LEAD SCORE HISTORY TABLE (IMMUTABLE)
// ============================================================================

export const crmLeadScoreHistory = pgTable(
  'crm_lead_score_history',
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

    // Score data
    scoreBefore: integer('score_before'),
    scoreAfter: integer('score_after').notNull(),
    scoreDelta: integer('score_delta'), // Generated column: score_after - score_before
    scoreBreakdown: jsonb('score_breakdown').notNull(),

    // Context
    triggerType: text('trigger_type').notNull(), // created, updated, manual, scheduled
    triggerUserId: uuid('trigger_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    triggerReason: text('trigger_reason'),

    // Audit trail (immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Index for lead score history queries (get history for a lead)
    leadIdIdx: index('idx_lead_score_history_lead_id').on(table.leadId, table.createdAt),
    // Index for workspace-level analytics
    workspaceIdIdx: index('idx_lead_score_history_workspace').on(
      table.workspaceId,
      table.createdAt
    ),
  })
);

// ============================================================================
// OPPORTUNITIES TABLE
// ============================================================================

export const crmOpportunities = pgTable(
  'crm_opportunities',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Relationships
    accountId: uuid('account_id')
      .references(() => crmAccounts.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),

    // Basic information
    name: text('name').notNull(),

    // Pipeline stage
    stage: opportunityStageEnum('stage').notNull().default('prospecting'),
    status: opportunityStatusEnum('status').notNull().default('open'),

    // Outcome tracking (US-CRM-STATE-MACHINE T-008)
    outcome: opportunityOutcomeEnum('outcome').default('open').notNull(),
    lostReason: lostReasonEnum('lost_reason'),
    lostNotes: text('lost_notes'),
    wonAmount: numeric('won_amount', { precision: 15, scale: 2 }), // Actual closed amount
    contractSignedAt: timestamp('contract_signed_at', { withTimezone: true }),
    closedBy: uuid('closed_by'), // user who closed the deal

    // Financial
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('ZAR'),
    probability: integer('probability').notNull().default(0), // 0-100

    // Dates
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    actualCloseDate: timestamp('actual_close_date', { withTimezone: true }),

    // Win/Loss analysis
    winLossReason: text('win_loss_reason'),

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Source
    leadSource: text('lead_source'),

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    customFields: jsonb('custom_fields').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_opportunities_workspace_id').on(table.workspaceId),
    accountIdIdx: index('idx_crm_opportunities_account_id').on(table.accountId),
    contactIdIdx: index('idx_crm_opportunities_contact_id').on(table.contactId),
    stageIdx: index('idx_crm_opportunities_stage').on(table.stage),
    statusIdx: index('idx_crm_opportunities_status').on(table.status),
    ownerIdIdx: index('idx_crm_opportunities_owner_id').on(table.ownerId),
    expectedCloseDateIdx: index('idx_crm_opportunities_expected_close_date').on(
      table.expectedCloseDate
    ),
  })
);

// ============================================================================
// ACTIVITIES TABLE
// ============================================================================

export const crmActivities = pgTable(
  'crm_activities',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Activity details
    type: activityTypeEnum('type').notNull(),
    subject: text('subject').notNull(),
    description: text('description'),
    status: activityStatusEnum('status').notNull().default('planned'),
    priority: activityPriorityEnum('priority').notNull().default('medium'),

    // Dates
    dueDate: timestamp('due_date', { withTimezone: true }),
    completedDate: timestamp('completed_date', { withTimezone: true }),
    duration: integer('duration'), // in minutes

    // Polymorphic relationships (link to any entity)
    contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
    accountId: uuid('account_id').references(() => crmAccounts.id, { onDelete: 'set null' }),
    opportunityId: uuid('opportunity_id').references(() => crmOpportunities.id, {
      onDelete: 'set null',
    }),
    leadId: uuid('lead_id').references(() => crmLeads.id, { onDelete: 'set null' }),

    // Assignment
    assigneeId: uuid('assignee_id')
      .references(() => users.id, { onDelete: 'set null' }),

    // Outcome
    outcome: text('outcome'),
    disposition: text('disposition'), // Call disposition: connected, voicemail, no_answer, busy, callback_requested

    // Channel integration (US-SALES-QUEUE-001)
    direction: text('direction'), // 'inbound' or 'outbound'
    channel: text('channel'), // 'call', 'sms', 'email', 'chat', 'social'
    channelMessageId: text('channel_message_id'), // External provider ID (Twilio SID, etc)
    channelStatus: text('channel_status'), // Provider-specific status
    channelErrorCode: text('channel_error_code'), // Error code if delivery failed
    channelMetadata: jsonb('channel_metadata').notNull().default({}), // Additional channel data

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_activities_workspace_id').on(table.workspaceId),
    assigneeIdIdx: index('idx_crm_activities_assignee_id').on(table.assigneeId),
    contactIdIdx: index('idx_crm_activities_contact_id').on(table.contactId),
    accountIdIdx: index('idx_crm_activities_account_id').on(table.accountId),
    opportunityIdIdx: index('idx_crm_activities_opportunity_id').on(table.opportunityId),
    leadIdIdx: index('idx_crm_activities_lead_id').on(table.leadId),
    dueDateIdx: index('idx_crm_activities_due_date').on(table.dueDate),
    statusIdx: index('idx_crm_activities_status').on(table.status),
    // Agent recent activity lookup
    leadRecentActivityIdx: index('idx_crm_activities_lead_recent').on(table.leadId, table.createdAt),
    // Channel integration indexes (US-SALES-QUEUE-001)
    channelLookupIdx: index('idx_crm_activities_channel_lookup').on(table.leadId, table.channel, table.createdAt),
    channelStatusIdx: index('idx_crm_activities_channel_status').on(table.workspaceId, table.channel, table.channelStatus),
  })
);

// ============================================================================
// TIMELINE EVENTS TABLE (IMMUTABLE)
// ============================================================================

export const crmTimelineEvents = pgTable(
  'crm_timeline_events',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Polymorphic entity reference
    entityType: timelineEntityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    // Event details
    eventType: text('event_type').notNull(), // e.g., "contact.created", "activity.completed"
    eventCategory: timelineEventCategoryEnum('event_category').notNull(),
    eventLabel: text('event_label').notNull(), // Human-readable
    summary: text('summary').notNull(),
    description: text('description'),

    // Timestamps
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), // When event happened (can be backdated)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), // When logged (immutable)
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // Actor
    actorType: timelineActorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name'),

    // Audit trail (Agios standard)
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    // Event data (JSONB for flexibility)
    communication: jsonb('communication'),
    dataChanges: jsonb('data_changes'),

    // Metadata
    tags: text('tags').array().notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),

    // Pinning
    isPinned: boolean('is_pinned').notNull().default(false),
    pinnedBy: uuid('pinned_by').references(() => users.id, { onDelete: 'set null' }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),

    // Soft delete (rare, compliance-driven)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_timeline_events_workspace_id').on(table.workspaceId),
    entityIdx: index('idx_crm_timeline_events_entity').on(table.entityType, table.entityId),
    occurredAtIdx: index('idx_crm_timeline_events_occurred_at').on(table.occurredAt),
    eventCategoryIdx: index('idx_crm_timeline_events_event_category').on(table.eventCategory),
  })
);

// ============================================================================
// EMAIL TEMPLATES TABLE
// ============================================================================

export const crmEmailTemplates = pgTable(
  'crm_email_templates',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Template details
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(), // HTML email body with {{variable}} placeholders
    variables: jsonb('variables').notNull().default([]), // Array of variable names used in template
    category: text('category'), // Optional categorization (e.g., 'sales', 'support', 'marketing')

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Audit fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_email_templates_workspace_id').on(table.workspaceId),
    categoryIdx: index('idx_crm_email_templates_category').on(table.category),
    isActiveIdx: index('idx_crm_email_templates_is_active').on(table.isActive),
  })
);

// ============================================================================
// LEAD IMPORTS TABLE
// ============================================================================

export const crmLeadImports = pgTable(
  'crm_lead_imports',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // User who initiated import
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),

    // File information
    filename: text('filename').notNull(),

    // Import status and progress
    status: crmImportStatusEnum('status').notNull().default('validating'),
    totalRows: integer('total_rows').notNull().default(0),
    processedRows: integer('processed_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    errorRows: integer('error_rows').notNull().default(0),

    // Configuration
    columnMapping: jsonb('column_mapping').notNull().default({}),
    duplicateStrategy: text('duplicate_strategy').notNull().default('skip'), // skip, update, create
    validationMode: text('validation_mode').notNull().default('lenient'), // strict, lenient

    // Error handling
    errorFileUrl: text('error_file_url'),
    errorDetails: jsonb('error_details').notNull().default([]),

    // Created list reference
    listId: uuid('list_id').references(() => crmContactLists.id, { onDelete: 'set null' }),

    // Timestamps
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('idx_lead_imports_workspace').on(table.workspaceId, table.createdAt),
    statusIdx: index('idx_lead_imports_status').on(table.workspaceId, table.status),
    userIdIdx: index('idx_lead_imports_user').on(table.userId, table.createdAt),
    listIdIdx: index('idx_lead_imports_list_id').on(table.listId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmAccountsRelations = relations(crmAccounts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmAccounts.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [crmAccounts.ownerId],
    references: [users.id],
  }),
  parentAccount: one(crmAccounts, {
    fields: [crmAccounts.parentAccountId],
    references: [crmAccounts.id],
  }),
  childAccounts: many(crmAccounts),
  contacts: many(crmContacts),
  opportunities: many(crmOpportunities),
  activities: many(crmActivities),
}));

export const crmContactsRelations = relations(crmContacts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmContacts.workspaceId],
    references: [workspaces.id],
  }),
  account: one(crmAccounts, {
    fields: [crmContacts.accountId],
    references: [crmAccounts.id],
  }),
  owner: one(users, {
    fields: [crmContacts.ownerId],
    references: [users.id],
  }),
  opportunities: many(crmOpportunities),
  activities: many(crmActivities),
  convertedLeads: many(crmLeads),
}));

export const crmLeadsRelations = relations(crmLeads, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmLeads.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [crmLeads.ownerId],
    references: [users.id],
  }),
  convertedContact: one(crmContacts, {
    fields: [crmLeads.convertedContactId],
    references: [crmContacts.id],
  }),
  scoreHistory: many(crmLeadScoreHistory),
}));

export const crmOpportunitiesRelations = relations(crmOpportunities, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmOpportunities.workspaceId],
    references: [workspaces.id],
  }),
  account: one(crmAccounts, {
    fields: [crmOpportunities.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [crmOpportunities.contactId],
    references: [crmContacts.id],
  }),
  owner: one(users, {
    fields: [crmOpportunities.ownerId],
    references: [users.id],
  }),
  activities: many(crmActivities),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmActivities.workspaceId],
    references: [workspaces.id],
  }),
  assignee: one(users, {
    fields: [crmActivities.assigneeId],
    references: [users.id],
  }),
  contact: one(crmContacts, {
    fields: [crmActivities.contactId],
    references: [crmContacts.id],
  }),
  account: one(crmAccounts, {
    fields: [crmActivities.accountId],
    references: [crmAccounts.id],
  }),
  opportunity: one(crmOpportunities, {
    fields: [crmActivities.opportunityId],
    references: [crmOpportunities.id],
  }),
  lead: one(crmLeads, {
    fields: [crmActivities.leadId],
    references: [crmLeads.id],
  }),
}));

export const crmLeadScoreHistoryRelations = relations(crmLeadScoreHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmLeadScoreHistory.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [crmLeadScoreHistory.leadId],
    references: [crmLeads.id],
  }),
  triggerUser: one(users, {
    fields: [crmLeadScoreHistory.triggerUserId],
    references: [users.id],
  }),
}));

export const crmTimelineEventsRelations = relations(crmTimelineEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmTimelineEvents.workspaceId],
    references: [workspaces.id],
  }),
  actor: one(users, {
    fields: [crmTimelineEvents.actorId],
    references: [users.id],
  }),
  pinnedByUser: one(users, {
    fields: [crmTimelineEvents.pinnedBy],
    references: [users.id],
  }),
}));

export const crmEmailTemplatesRelations = relations(crmEmailTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmEmailTemplates.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [crmEmailTemplates.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [crmEmailTemplates.updatedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// SMS TEMPLATES TABLE
// ============================================================================

export const crmSmsTemplates = pgTable(
  'crm_sms_templates',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Template details
    name: text('name').notNull(),
    body: text('body').notNull(), // SMS message with {{variable}} placeholders
    variables: jsonb('variables').notNull().default([]), // Array of variable names used in template
    category: text('category'), // Optional categorization (e.g., 'sales', 'support', 'marketing')
    maxSegments: integer('max_segments').notNull().default(3), // Recommended max SMS segments for this template

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Audit fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_sms_templates_workspace_id').on(table.workspaceId),
    categoryIdx: index('idx_crm_sms_templates_category').on(table.category),
    isActiveIdx: index('idx_crm_sms_templates_is_active').on(table.isActive),
  })
);

export const crmSmsTemplatesRelations = relations(crmSmsTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmSmsTemplates.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [crmSmsTemplates.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [crmSmsTemplates.updatedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmAccount = typeof crmAccounts.$inferSelect;
export type NewCrmAccount = typeof crmAccounts.$inferInsert;

export type CrmContact = typeof crmContacts.$inferSelect;
export type NewCrmContact = typeof crmContacts.$inferInsert;

export type CrmLead = typeof crmLeads.$inferSelect;
export type NewCrmLead = typeof crmLeads.$inferInsert;

export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type NewCrmOpportunity = typeof crmOpportunities.$inferInsert;

export type CrmActivity = typeof crmActivities.$inferSelect;
export type NewCrmActivity = typeof crmActivities.$inferInsert;

export type CrmTimelineEvent = typeof crmTimelineEvents.$inferSelect;
export type NewCrmTimelineEvent = typeof crmTimelineEvents.$inferInsert;

export type CrmLeadScoreHistory = typeof crmLeadScoreHistory.$inferSelect;
export type NewCrmLeadScoreHistory = typeof crmLeadScoreHistory.$inferInsert;

export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type NewCrmEmailTemplate = typeof crmEmailTemplates.$inferInsert;

export type CrmSmsTemplate = typeof crmSmsTemplates.$inferSelect;
export type NewCrmSmsTemplate = typeof crmSmsTemplates.$inferInsert;

export type ContactStatus = (typeof contactStatusEnum.enumValues)[number];
export type LifecycleStage = (typeof lifecycleStageEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type OpportunityStage = (typeof opportunityStageEnum.enumValues)[number];
export type OpportunityStatus = (typeof opportunityStatusEnum.enumValues)[number];
export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type ActivityStatus = (typeof activityStatusEnum.enumValues)[number];
export type ActivityPriority = (typeof activityPriorityEnum.enumValues)[number];
export type TimelineEntityType = (typeof timelineEntityTypeEnum.enumValues)[number];
export type TimelineEventCategory = (typeof timelineEventCategoryEnum.enumValues)[number];
export type TimelineActorType = (typeof timelineActorTypeEnum.enumValues)[number];

export type CrmLeadImport = typeof crmLeadImports.$inferSelect;
export type NewCrmLeadImport = typeof crmLeadImports.$inferInsert;
export type CrmImportStatus = (typeof crmImportStatusEnum.enumValues)[number];

// State machine enum types (US-CRM-STATE-MACHINE)
export type LeadContactability = (typeof leadContactabilityEnum.enumValues)[number];
export type BlacklistReason = (typeof blacklistReasonEnum.enumValues)[number];
export type ContactDisposition = (typeof contactDispositionEnum.enumValues)[number];
export type OpportunityOutcome = (typeof opportunityOutcomeEnum.enumValues)[number];
export type LostReason = (typeof lostReasonEnum.enumValues)[number];

// Calls table for tracking voice calls
export const crmCalls = pgTable('crm_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  // Contact/Lead references
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => crmLeads.id, { onDelete: 'set null' }),

  // Call details
  direction: text('direction').notNull().$type<'inbound' | 'outbound'>(),
  toNumber: text('to_number').notNull(),
  fromNumber: text('from_number').notNull(),
  status: text('status').notNull().default('queued').$type<'queued' | 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'busy' | 'no_answer'>(),
  purpose: text('purpose').$type<'sales' | 'support' | 'follow_up' | 'ai_outreach'>(),

  // External references
  externalCallId: text('external_call_id'), // Twilio SID or other provider ID

  // Timing
  duration: integer('duration'), // Duration in seconds
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('idx_crm_calls_workspace_id').on(table.workspaceId),
  contactIdIdx: index('idx_crm_calls_contact_id').on(table.contactId),
  leadIdIdx: index('idx_crm_calls_lead_id').on(table.leadId),
  statusIdx: index('idx_crm_calls_status').on(table.status),
  createdAtIdx: index('idx_crm_calls_created_at').on(table.createdAt),
}));

export const crmCallsRelations = relations(crmCalls, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmCalls.workspaceId],
    references: [workspaces.id],
  }),
  contact: one(crmContacts, {
    fields: [crmCalls.contactId],
    references: [crmContacts.id],
  }),
  lead: one(crmLeads, {
    fields: [crmCalls.leadId],
    references: [crmLeads.id],
  }),
}));

export type CrmCall = typeof crmCalls.$inferSelect;
export type NewCrmCall = typeof crmCalls.$inferInsert;
