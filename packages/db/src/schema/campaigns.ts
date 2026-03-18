/**
 * Campaigns Schema
 * Multi-channel campaign management tables for CRM
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
  decimal,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmContacts } from './crm';
import { crmContactLists } from './contact-lists';

// ============================================================================
// CAMPAIGNS TABLE
// ============================================================================

export const crmCampaigns = pgTable(
  'crm_campaigns',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),

    // Campaign type and objective
    objective: text('objective').notNull(), // lead_generation|sales|awareness|retention|nurture
    type: text('type').notNull(), // one_time|recurring|drip|ab_test
    status: text('status').notNull().default('draft'), // draft|scheduled|active|paused|completed|cancelled|archived

    // Tags for organization
    tags: text('tags').array().notNull().default([]),

    // Timing
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    timezone: text('timezone').notNull().default('UTC'),

    // Recurring campaign scheduling
    schedule: text('schedule'), // Cron expression for recurring campaigns
    lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
    nextExecutionAt: timestamp('next_execution_at', { withTimezone: true }),

    // Targeting (mutually exclusive: either list_id OR audience_definition)
    listId: uuid('list_id').references(() => crmContactLists.id, { onDelete: 'restrict' }), // NEW: Reference to contact list
    recipientSelection: text('recipient_selection'), // Production uses text (JSON string), not native JSONB
    audienceDefinition: jsonb('audience_definition').notNull().default({}), // Filter conditions (legacy approach)
    audienceSize: integer('audience_size'),
    audienceLastCalculatedAt: timestamp('audience_last_calculated_at', { withTimezone: true }),

    // Channels (email, sms, whatsapp - email only in Phase 1)
    channels: text('channels').array().notNull().default([]), // ['email']
    channelConfig: jsonb('channel_config').notNull().default({}), // Channel-specific settings
    emailConfig: jsonb('email_config'), // Email-specific config: {from_email, from_name, reply_to}

    // Test mode (for safe testing with real APIs)
    testMode: boolean('test_mode').notNull().default(false), // If true, uses test numbers/emails

    // Statistics
    totalRecipients: integer('total_recipients').notNull().default(0),
    totalSent: integer('total_sent').notNull().default(0),
    totalDelivered: integer('total_delivered').notNull().default(0),
    totalOpened: integer('total_opened').notNull().default(0),
    totalClicked: integer('total_clicked').notNull().default(0),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_campaigns_workspace_id').on(table.workspaceId),
    statusIdx: index('idx_crm_campaigns_status').on(table.status),
    scheduledStartAtIdx: index('idx_crm_campaigns_scheduled_start_at').on(table.scheduledStartAt),
    nextExecutionAtIdx: index('idx_crm_campaigns_next_execution_at').on(table.nextExecutionAt),
    listIdIdx: index('idx_crm_campaigns_list_id').on(table.listId), // NEW: Index for list-based campaigns
  })
);

// ============================================================================
// CAMPAIGN RECIPIENTS TABLE
// ============================================================================

export const crmCampaignRecipients = pgTable(
  'crm_campaign_recipients',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => crmContacts.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // A/B Testing - Track which variant was sent to this recipient
    variantName: text('variant_name'),
    messageId: uuid('message_id').references(() => crmCampaignMessages.id, { onDelete: 'set null' }),

    // Status tracking
    status: text('status').notNull().default('pending'), // pending|queued|sent|delivered|bounced|failed|opted_out
    statusReason: text('status_reason'), // Error details or bounce reason

    // Engagement tracking
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    firstOpenedAt: timestamp('first_opened_at', { withTimezone: true }),
    openCount: integer('open_count').notNull().default(0),
    firstClickedAt: timestamp('first_clicked_at', { withTimezone: true }),
    clickCount: integer('click_count').notNull().default(0),

    // Resend integration
    resendEmailId: text('resend_email_id'), // Resend email ID for webhook tracking
    bounceType: text('bounce_type'), // hard_bounce|soft_bounce|spam_complaint
    bounceDescription: text('bounce_description'), // Bounce reason from Resend

    // Audit trail
    addedToCampaignAt: timestamp('added_to_campaign_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    campaignIdIdx: index('idx_crm_campaign_recipients_campaign_id').on(table.campaignId),
    contactIdIdx: index('idx_crm_campaign_recipients_contact_id').on(table.contactId),
    statusIdx: index('idx_crm_campaign_recipients_status').on(table.status),
    workspaceIdIdx: index('idx_crm_campaign_recipients_workspace_id').on(table.workspaceId),
    messageIdIdx: index('idx_crm_campaign_recipients_message_id').on(table.messageId),
  })
);

// ============================================================================
// CAMPAIGN MESSAGES TABLE
// ============================================================================

export const crmCampaignMessages = pgTable(
  'crm_campaign_messages',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Message details
    name: text('name').notNull(),
    channel: text('channel').notNull(), // email|sms|whatsapp

    // A/B Testing fields
    variantName: text('variant_name'), // "A", "B", "C", etc.
    isControl: boolean('is_control').default(false), // Is this the control variant?
    testPercentage: integer('test_percentage'), // Percentage of recipients (0-100)

    // Drip Sequence fields
    sequenceOrder: integer('sequence_order'), // Order in drip sequence (1, 2, 3...)
    delayAmount: integer('delay_amount'), // How long to wait before sending
    delayUnit: text('delay_unit'), // minutes|hours|days|weeks
    triggerType: text('trigger_type'), // time_based|action_based
    triggerAction: text('trigger_action'), // opened|clicked|not_opened|not_clicked
    triggerMessageId: uuid('trigger_message_id').references(() => crmCampaignMessages.id, { onDelete: 'set null' }), // Which message to watch for action
    fallbackDelayDays: integer('fallback_delay_days').default(7), // Fallback timeout for action-based triggers

    // Email content
    subject: text('subject'), // Required for email
    bodyText: text('body_text').notNull(),
    bodyHtml: text('body_html'), // Optional for email
    previewText: text('preview_text'), // Email preview text

    // Sender information (email)
    sendFromName: text('send_from_name'),
    sendFromEmail: text('send_from_email'),
    replyToEmail: text('reply_to_email'),

    // Personalization
    mergeTags: text('merge_tags').array().notNull().default([]), // ['first_name', 'company']
    fallbackValues: jsonb('fallback_values').notNull().default({}), // { first_name: 'there' }

    // Tracking settings
    trackOpens: boolean('track_opens').notNull().default(true),
    trackClicks: boolean('track_clicks').notNull().default(true),

    // Statistics
    totalSent: integer('total_sent').notNull().default(0),
    totalDelivered: integer('total_delivered').notNull().default(0),
    totalOpened: integer('total_opened').notNull().default(0),
    totalClicked: integer('total_clicked').notNull().default(0),

    // Voice/AI call fields (present in production DB)
    aiScriptId: uuid('ai_script_id'), // Reference to AI voice script
    aiCallConfig: jsonb('ai_call_config'), // Voice call configuration (provider, voice, etc.)

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    campaignIdIdx: index('idx_crm_campaign_messages_campaign_id').on(table.campaignId),
    workspaceIdIdx: index('idx_crm_campaign_messages_workspace_id').on(table.workspaceId),
    variantNameIdx: index('idx_crm_campaign_messages_variant_name').on(table.variantName),
  })
);

// ============================================================================
// DRIP ENROLLMENTS TABLE
// ============================================================================

export const crmDripEnrollments = pgTable(
  'crm_drip_enrollments',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => crmCampaignRecipients.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => crmContacts.id, { onDelete: 'cascade' }),

    // Sequence tracking
    currentSequenceStep: integer('current_sequence_step').notNull().default(1),
    nextMessageId: uuid('next_message_id').references(() => crmCampaignMessages.id, { onDelete: 'set null' }),
    nextScheduledAt: timestamp('next_scheduled_at', { withTimezone: true }),

    // Status and lifecycle
    status: text('status').notNull(), // active|completed|paused|unsubscribed|failed
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    campaignIdIdx: index('idx_drip_enrollments_campaign').on(table.campaignId),
    statusIdx: index('idx_drip_enrollments_status').on(table.status),
    workspaceIdIdx: index('idx_drip_enrollments_workspace').on(table.workspaceId),
    recipientIdIdx: index('idx_drip_enrollments_recipient').on(table.recipientId),
    contactIdIdx: index('idx_drip_enrollments_contact').on(table.contactId),
  })
);

// ============================================================================
// A/B TEST RESULTS TABLE
// ============================================================================

export const crmAbTestResults = pgTable(
  'crm_ab_test_results',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => crmCampaignMessages.id, { onDelete: 'cascade' }),
    variantName: text('variant_name').notNull(),

    // Engagement metrics
    sentCount: integer('sent_count').notNull().default(0),
    deliveredCount: integer('delivered_count').notNull().default(0),
    openedCount: integer('opened_count').notNull().default(0),
    clickedCount: integer('clicked_count').notNull().default(0),
    bouncedCount: integer('bounced_count').notNull().default(0),

    // Calculated rates (stored as decimal percentages, e.g., 0.25 = 25%)
    openRate: decimal('open_rate', { precision: 5, scale: 4 }),
    clickRate: decimal('click_rate', { precision: 5, scale: 4 }),
    bounceRate: decimal('bounce_rate', { precision: 5, scale: 4 }),

    // Winner declaration
    winnerDeclaredAt: timestamp('winner_declared_at', { withTimezone: true }),
    isWinner: boolean('is_winner').notNull().default(false),
    winningCriteria: text('winning_criteria'), // 'open_rate', 'click_rate', 'manual', etc.

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    campaignIdIdx: index('idx_crm_ab_test_results_campaign_id').on(table.campaignId),
    messageIdIdx: index('idx_crm_ab_test_results_message_id').on(table.messageId),
    workspaceIdIdx: index('idx_crm_ab_test_results_workspace_id').on(table.workspaceId),
    isWinnerIdx: index('idx_crm_ab_test_results_is_winner').on(table.isWinner),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmCampaignsRelations = relations(crmCampaigns, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmCampaigns.workspaceId],
    references: [workspaces.id],
  }),
  list: one(crmContactLists, {
    fields: [crmCampaigns.listId],
    references: [crmContactLists.id],
  }),
  createdByUser: one(users, {
    fields: [crmCampaigns.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [crmCampaigns.updatedBy],
    references: [users.id],
  }),
  recipients: many(crmCampaignRecipients),
  messages: many(crmCampaignMessages),
  abTestResults: many(crmAbTestResults),
  dripEnrollments: many(crmDripEnrollments),
  snapshots: many(crmCampaignSnapshots),
}));

export const crmCampaignRecipientsRelations = relations(crmCampaignRecipients, ({ one }) => ({
  campaign: one(crmCampaigns, {
    fields: [crmCampaignRecipients.campaignId],
    references: [crmCampaigns.id],
  }),
  contact: one(crmContacts, {
    fields: [crmCampaignRecipients.contactId],
    references: [crmContacts.id],
  }),
  workspace: one(workspaces, {
    fields: [crmCampaignRecipients.workspaceId],
    references: [workspaces.id],
  }),
  addedByUser: one(users, {
    fields: [crmCampaignRecipients.addedBy],
    references: [users.id],
  }),
}));

export const crmCampaignMessagesRelations = relations(crmCampaignMessages, ({ one, many }) => ({
  campaign: one(crmCampaigns, {
    fields: [crmCampaignMessages.campaignId],
    references: [crmCampaigns.id],
  }),
  workspace: one(workspaces, {
    fields: [crmCampaignMessages.workspaceId],
    references: [workspaces.id],
  }),
  abTestResults: many(crmAbTestResults),
}));

export const crmAbTestResultsRelations = relations(crmAbTestResults, ({ one }) => ({
  campaign: one(crmCampaigns, {
    fields: [crmAbTestResults.campaignId],
    references: [crmCampaigns.id],
  }),
  message: one(crmCampaignMessages, {
    fields: [crmAbTestResults.messageId],
    references: [crmCampaignMessages.id],
  }),
  workspace: one(workspaces, {
    fields: [crmAbTestResults.workspaceId],
    references: [workspaces.id],
  }),
}));

export const crmDripEnrollmentsRelations = relations(crmDripEnrollments, ({ one }) => ({
  campaign: one(crmCampaigns, {
    fields: [crmDripEnrollments.campaignId],
    references: [crmCampaigns.id],
  }),
  recipient: one(crmCampaignRecipients, {
    fields: [crmDripEnrollments.recipientId],
    references: [crmCampaignRecipients.id],
  }),
  contact: one(crmContacts, {
    fields: [crmDripEnrollments.contactId],
    references: [crmContacts.id],
  }),
  workspace: one(workspaces, {
    fields: [crmDripEnrollments.workspaceId],
    references: [workspaces.id],
  }),
  nextMessage: one(crmCampaignMessages, {
    fields: [crmDripEnrollments.nextMessageId],
    references: [crmCampaignMessages.id],
  }),
}));

// ============================================================================
// CAMPAIGN SNAPSHOTS TABLE (for immutable audit trail)
// ============================================================================

export const crmCampaignSnapshots = pgTable(
  'crm_campaign_snapshots',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').notNull(), // No FK - list may be deleted after snapshot
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Snapshot data
    snapshotData: jsonb('snapshot_data').notNull(), // { memberIds: [], totalListSize, selectedCount }
    snapshotMetadata: jsonb('snapshot_metadata'), // { selectionStrategy, sortCriteria, excludedCount }

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('idx_campaign_snapshots_campaign').on(table.campaignId),
    workspaceIdIdx: index('idx_campaign_snapshots_workspace').on(table.workspaceId),
    listIdIdx: index('idx_campaign_snapshots_list').on(table.listId),
    createdAtIdx: index('idx_campaign_snapshots_created').on(table.createdAt),
  })
);

// ============================================================================
// TEST SMS SESSIONS TABLE (for test mode with correlation)
// ============================================================================

export const crmTestSmsSessions = pgTable(
  'crm_test_sms_sessions',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Test setup
    testPhoneNumber: text('test_phone_number').notNull(), // +15142409282 (our test number)
    contactId: uuid('contact_id')
      .notNull()
      .references(() => crmContacts.id, { onDelete: 'cascade' }),
    contactPhone: text('contact_phone').notNull(), // Real contact's phone number

    // Correlation (for inbound message routing)
    correlationId: text('correlation_id').notNull().unique(), // "K5", "A3", "🔵", etc.

    // Campaign context (optional - may test without campaign)
    campaignId: uuid('campaign_id').references(() => crmCampaigns.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id').references(() => crmCampaignRecipients.id, { onDelete: 'cascade' }),

    // Lifecycle
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '24 hours'`), // Auto-expire after 24 hours
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }), // Last time contact replied

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    correlationIdIdx: index('idx_test_sms_correlation').on(table.correlationId),
    contactIdIdx: index('idx_test_sms_contact').on(table.contactId),
    workspaceIdIdx: index('idx_test_sms_workspace').on(table.workspaceId),
    expiresAtIdx: index('idx_test_sms_expires').on(table.expiresAt), // For cleanup job
  })
);

// ============================================================================
// RELATIONS (Test Sessions)
// ============================================================================

export const crmCampaignSnapshotsRelations = relations(crmCampaignSnapshots, ({ one }) => ({
  campaign: one(crmCampaigns, {
    fields: [crmCampaignSnapshots.campaignId],
    references: [crmCampaigns.id],
  }),
  workspace: one(workspaces, {
    fields: [crmCampaignSnapshots.workspaceId],
    references: [workspaces.id],
  }),
}));

export const crmTestSmsSessionsRelations = relations(crmTestSmsSessions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmTestSmsSessions.workspaceId],
    references: [workspaces.id],
  }),
  contact: one(crmContacts, {
    fields: [crmTestSmsSessions.contactId],
    references: [crmContacts.id],
  }),
  campaign: one(crmCampaigns, {
    fields: [crmTestSmsSessions.campaignId],
    references: [crmCampaigns.id],
  }),
  recipient: one(crmCampaignRecipients, {
    fields: [crmTestSmsSessions.recipientId],
    references: [crmCampaignRecipients.id],
  }),
}));

// ============================================================================
// MOCK MESSAGES TABLE (for TEST_MODE without external services)
// ============================================================================

export const crmMockMessages = pgTable(
  'crm_mock_messages',
  {
    // Primary key
    id: text('id').primaryKey(), // mock_123456789_abc

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Message details
    channel: text('channel').notNull().$type<'email' | 'sms' | 'voice' | 'ai_voice' | 'whatsapp'>(),
    direction: text('direction').notNull().$type<'inbound' | 'outbound'>(),
    to: text('to').notNull(),
    from: text('from').notNull(),
    subject: text('subject'), // Email only
    content: text('content').notNull(),
    contentHtml: text('content_html'), // HTML version for email preview
    status: text('status').notNull().default('pending'),

    // Campaign context (optional)
    campaignId: uuid('campaign_id').references(() => crmCampaigns.id, { onDelete: 'set null' }),
    recipientId: uuid('recipient_id').references(() => crmCampaignRecipients.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id'), // References crmContacts but no FK for flexibility
    leadId: uuid('lead_id'), // References crmLeads but no FK for flexibility

    // Event tracking (JSONB array of events)
    events: jsonb('events').notNull().default([]),

    // Voice call metadata (for sandbox voice/ai_voice calls)
    voiceMetadata: jsonb('voice_metadata').$type<{
      originalTo?: string;       // Real contact number (when sandbox swaps to test number)
      isRealCall?: boolean;      // Whether this was a real call to test number
      duration?: number;         // Call duration in seconds
      recordingUrl?: string;     // URL to call recording
      transcription?: string;    // Call transcription
    }>(),

    // Extensibility
    metadata: jsonb('metadata'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_mock_messages_workspace').on(table.workspaceId),
    channelIdx: index('idx_mock_messages_channel').on(table.channel),
    directionIdx: index('idx_mock_messages_direction').on(table.direction),
    statusIdx: index('idx_mock_messages_status').on(table.status),
    createdAtIdx: index('idx_mock_messages_created').on(table.createdAt),
  })
);

export const crmMockMessagesRelations = relations(crmMockMessages, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmMockMessages.workspaceId],
    references: [workspaces.id],
  }),
  campaign: one(crmCampaigns, {
    fields: [crmMockMessages.campaignId],
    references: [crmCampaigns.id],
  }),
  recipient: one(crmCampaignRecipients, {
    fields: [crmMockMessages.recipientId],
    references: [crmCampaignRecipients.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmTestSmsSession = typeof crmTestSmsSessions.$inferSelect;
export type NewCrmTestSmsSession = typeof crmTestSmsSessions.$inferInsert;

export type CrmMockMessage = typeof crmMockMessages.$inferSelect;
export type NewCrmMockMessage = typeof crmMockMessages.$inferInsert;

export type CrmCampaign = typeof crmCampaigns.$inferSelect;
export type NewCrmCampaign = typeof crmCampaigns.$inferInsert;

export type CrmCampaignRecipient = typeof crmCampaignRecipients.$inferSelect;
export type NewCrmCampaignRecipient = typeof crmCampaignRecipients.$inferInsert;

export type CrmCampaignMessage = typeof crmCampaignMessages.$inferSelect;
export type NewCrmCampaignMessage = typeof crmCampaignMessages.$inferInsert;

export type CrmAbTestResult = typeof crmAbTestResults.$inferSelect;
export type NewCrmAbTestResult = typeof crmAbTestResults.$inferInsert;

export type CrmDripEnrollment = typeof crmDripEnrollments.$inferSelect;
export type NewCrmDripEnrollment = typeof crmDripEnrollments.$inferInsert;

export type CrmCampaignSnapshot = typeof crmCampaignSnapshots.$inferSelect;
export type NewCrmCampaignSnapshot = typeof crmCampaignSnapshots.$inferInsert;

export type CampaignObjective = 'lead_generation' | 'sales' | 'awareness' | 'retention' | 'nurture';
export type CampaignType = 'one_time' | 'recurring' | 'drip' | 'ab_test';
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived';
export type RecipientStatus =
  | 'pending'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'opted_out';
export type CampaignChannel = 'email' | 'sms' | 'whatsapp';
export type ABTestWinningCriteria = 'open_rate' | 'click_rate' | 'manual' | 'engagement';
export type DripEnrollmentStatus = 'active' | 'completed' | 'paused' | 'unsubscribed' | 'failed';
export type DripDelayUnit = 'minutes' | 'hours' | 'days' | 'weeks';
export type DripTriggerType = 'time_based' | 'action_based';
export type DripTriggerAction = 'opened' | 'clicked' | 'not_opened' | 'not_clicked';

// Recipient selection configuration type
export interface RecipientSelectionConfig {
  maxRecipients?: number;
  selectionStrategy: 'first' | 'random' | 'prioritized';
  sortCriteria?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  excludePreviousRecipients?: boolean;
}

// Campaign snapshot data type
export interface CampaignSnapshotData {
  memberIds: string[];
  totalListSize: number;
  selectedCount: number;
}

// Campaign snapshot metadata type
export interface CampaignSnapshotMetadata {
  selectionStrategy?: string;
  sortCriteria?: {
    field: string;
    direction: string;
  };
  excludedCount?: number;
}
