/**
 * CRM Data Sync Schema (Phase V)
 * Three tables: sync connections, field mappings, and sync logs
 *
 * Supports:
 * - OAuth connections to external CRMs (Salesforce, HubSpot)
 * - Configurable field mappings between Agios and external systems
 * - Detailed sync history and audit trail
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

// ============================================================================
// CRM SYNC CONNECTIONS TABLE
// ============================================================================

export const crmSyncConnections = pgTable(
  'crm_sync_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Provider info
    provider: text('provider').notNull(), // 'salesforce' | 'hubspot'
    name: text('name').notNull(), // Display name for this connection

    // OAuth credentials (encrypted at rest)
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    instanceUrl: text('instance_url'), // e.g., Salesforce instance URL
    externalAccountId: text('external_account_id'), // SF org ID or HubSpot portal ID

    // Sync configuration
    syncDirection: text('sync_direction').notNull().default('bidirectional'), // 'inbound' | 'outbound' | 'bidirectional'
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    syncFrequencyMinutes: integer('sync_frequency_minutes').notNull().default(15),

    // Sync state
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSyncStatus: text('last_sync_status').notNull().default('never'), // 'success' | 'partial' | 'error' | 'never'
    lastSyncError: text('last_sync_error'),
    lastSyncStats: jsonb('last_sync_stats'), // e.g., { created: 5, updated: 10, skipped: 2, errors: 1 }

    // Audit
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('crm_sync_conn_workspace_idx').on(table.workspaceId),
    providerIdx: index('crm_sync_conn_provider_idx').on(table.provider),
  })
);

// Relations
export const crmSyncConnectionsRelations = relations(crmSyncConnections, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmSyncConnections.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [crmSyncConnections.createdBy],
    references: [users.id],
  }),
  fieldMappings: many(crmFieldMappings),
  syncLogs: many(crmSyncLogs),
}));

// Types
export type CrmSyncConnection = typeof crmSyncConnections.$inferSelect;
export type NewCrmSyncConnection = typeof crmSyncConnections.$inferInsert;

export type SyncProvider = 'salesforce' | 'hubspot';
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';
export type SyncStatus = 'success' | 'partial' | 'error' | 'never';

export type SyncStats = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

// ============================================================================
// CRM FIELD MAPPINGS TABLE
// ============================================================================

export const crmFieldMappings = pgTable(
  'crm_field_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => crmSyncConnections.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Mapping definition
    entityType: text('entity_type').notNull(), // 'lead' | 'contact' | 'account' | 'opportunity'
    localField: text('local_field').notNull(), // Agios field path, e.g., 'firstName', 'customFields.industry'
    externalField: text('external_field').notNull(), // SF/HubSpot field, e.g., 'FirstName', 'properties.industry'
    direction: text('direction').notNull().default('bidirectional'), // 'inbound' | 'outbound' | 'bidirectional'

    // Transform configuration
    transformType: text('transform_type').notNull().default('none'), // 'none' | 'uppercase' | 'lowercase' | 'date_format' | 'custom'
    transformConfig: jsonb('transform_config'),

    // Field behavior
    isRequired: boolean('is_required').notNull().default(false),
    isKey: boolean('is_key').notNull().default(false), // Used for matching/dedup

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    connectionIdx: index('crm_field_map_connection_idx').on(table.connectionId),
    entityTypeIdx: index('crm_field_map_entity_type_idx').on(table.entityType),
  })
);

// Relations
export const crmFieldMappingsRelations = relations(crmFieldMappings, ({ one }) => ({
  connection: one(crmSyncConnections, {
    fields: [crmFieldMappings.connectionId],
    references: [crmSyncConnections.id],
  }),
  workspace: one(workspaces, {
    fields: [crmFieldMappings.workspaceId],
    references: [workspaces.id],
  }),
}));

// Types
export type CrmFieldMapping = typeof crmFieldMappings.$inferSelect;
export type NewCrmFieldMapping = typeof crmFieldMappings.$inferInsert;

export type SyncEntityType = 'lead' | 'contact' | 'account' | 'opportunity';
export type FieldMappingDirection = 'inbound' | 'outbound' | 'bidirectional';
export type TransformType = 'none' | 'uppercase' | 'lowercase' | 'date_format' | 'custom';

// ============================================================================
// CRM SYNC LOGS TABLE
// ============================================================================

export const crmSyncLogs = pgTable(
  'crm_sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // References
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => crmSyncConnections.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Sync details
    syncType: text('sync_type').notNull(), // 'full' | 'delta' | 'manual'
    direction: text('direction').notNull(), // 'inbound' | 'outbound'
    entityType: text('entity_type').notNull(), // 'lead' | 'contact' | 'account' | 'opportunity'
    status: text('status').notNull(), // 'running' | 'success' | 'partial' | 'error'

    // Statistics
    recordsProcessed: integer('records_processed').notNull().default(0),
    recordsCreated: integer('records_created').notNull().default(0),
    recordsUpdated: integer('records_updated').notNull().default(0),
    recordsSkipped: integer('records_skipped').notNull().default(0),
    recordsErrored: integer('records_errored').notNull().default(0),

    // Error details
    errors: jsonb('errors'), // Array of { record: string; error: string }

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),

    // Incremental sync cursor
    deltaToken: text('delta_token'),
  },
  (table) => ({
    connectionIdx: index('crm_sync_log_connection_idx').on(table.connectionId),
    workspaceIdx: index('crm_sync_log_workspace_idx').on(table.workspaceId),
    statusIdx: index('crm_sync_log_status_idx').on(table.status),
    startedAtIdx: index('crm_sync_log_started_at_idx').on(table.startedAt),
  })
);

// Relations
export const crmSyncLogsRelations = relations(crmSyncLogs, ({ one }) => ({
  connection: one(crmSyncConnections, {
    fields: [crmSyncLogs.connectionId],
    references: [crmSyncConnections.id],
  }),
  workspace: one(workspaces, {
    fields: [crmSyncLogs.workspaceId],
    references: [workspaces.id],
  }),
}));

// Types
export type CrmSyncLog = typeof crmSyncLogs.$inferSelect;
export type NewCrmSyncLog = typeof crmSyncLogs.$inferInsert;

export type SyncType = 'full' | 'delta' | 'manual';
export type SyncLogStatus = 'running' | 'success' | 'partial' | 'error';

export type SyncErrorDetail = {
  record: string;
  error: string;
};
