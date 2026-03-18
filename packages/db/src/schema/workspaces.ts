/**
 * Workspaces Schema
 * Multi-tenant boundary for data isolation
 */

import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { workspaceMembers } from './workspace-members';
import { hookEvents } from './hook-events';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// Relations
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  hookEvents: many(hookEvents),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

// ============================================================================
// WORKSPACE SETTINGS TYPE DEFINITIONS
// ============================================================================

/**
 * Country codes supported for phone numbers
 */
export type PhoneCountryCode = 'ZA' | 'CA' | 'US' | 'GB' | 'AU';

/**
 * Phone number capabilities
 */
export type PhoneCapability = 'sms' | 'voice' | 'mms';

/**
 * A Twilio phone number configured for a workspace
 */
export interface WorkspacePhoneNumber {
  id: string;                         // Twilio Phone Number SID (PN...)
  number: string;                     // E.164 format (+27... or +1...)
  country: PhoneCountryCode;          // Country code
  capabilities: PhoneCapability[];    // What the number can do
  isDefault: boolean;                 // Is this the default sender?
  friendlyName?: string;              // Optional display name
}

/**
 * Twilio-specific settings for a workspace
 */
export interface WorkspaceTwilioSettings {
  defaultPhoneNumber?: string;        // Primary workspace number (E.164)
  phoneNumbers?: WorkspacePhoneNumber[]; // Available phone numbers
  webhookSecret?: string;             // For inbound routing verification
}

/**
 * SMS Rate Limit Settings (Phase H.3)
 * Configurable rate limits for bulk SMS campaigns
 */
export interface WorkspaceSmsRateLimitSettings {
  /** Enable rate limiting for SMS campaigns */
  enabled: boolean;
  /** Maximum SMS messages per minute (default: 60) */
  smsPerMinute?: number;
  /** Maximum SMS messages per hour (default: 1000) */
  smsPerHour?: number;
  /** Maximum SMS messages per day (default: 10000) */
  smsPerDay?: number;
  /** Number of messages per batch (default: 100) */
  batchSize?: number;
  /** Delay between batches in milliseconds (default: 1000) */
  batchDelayMs?: number;
}

/**
 * Email Rate Limit Settings (Phase P)
 * Configurable rate limits for bulk email campaigns
 */
export interface WorkspaceEmailRateLimitSettings {
  /** Enable rate limiting for email campaigns */
  enabled: boolean;
  /** Maximum emails per minute (default: 100) */
  emailsPerMinute?: number;
  /** Maximum emails per hour (default: 5000) */
  emailsPerHour?: number;
  /** Maximum emails per day (default: 50000) */
  emailsPerDay?: number;
  /** Number of emails per batch (default: 100) */
  batchSize?: number;
  /** Delay between batches in milliseconds (default: 500) */
  batchDelayMs?: number;
}

/**
 * Email Compliance Settings (Phase P)
 * CAN-SPAM / GDPR / POPIA compliance configuration
 */
export interface WorkspaceEmailComplianceSettings {
  /** Physical mailing address for CAN-SPAM compliance */
  physicalAddress?: string;
  /** Company name for email footer */
  companyName?: string;
  /** Number of soft bounces before converting to hard suppression (default: 3) */
  softBounceThreshold?: number;
  /** Auto-suppress on spam complaint (default: true) */
  autoSuppressOnComplaint?: boolean;
  /** Auto-suppress on hard bounce (default: true) */
  autoSuppressOnHardBounce?: boolean;
  /** Default unsubscribe URL (generated per workspace if not set) */
  unsubscribeUrl?: string;
}

/**
 * Sandbox Mode Settings
 * Intercepts outbound communications for safe demo/onboarding with real data
 */
export interface WorkspaceSandboxSettings {
  /** Enable sandbox mode (intercepts outbound messages) */
  enabled: boolean;
  /** Test phone number for voice/AI voice calls (receives real calls instead of contact) */
  voiceTestNumber?: string;
  /** Auto-simulate delivery events after sending (default: true) */
  autoSimulateDelivery?: boolean;
  /** Delay in ms before auto-simulated delivery event (default: 2000) */
  autoSimulateDelayMs?: number;
}

/**
 * Complete workspace settings structure
 * Stored in the `settings` JSONB column
 */
export interface WorkspaceSettings {
  /** Custom platform name (default: 'NewLeads') */
  platformName?: string;
  twilio?: WorkspaceTwilioSettings;
  /** SMS rate limiting configuration (Phase H.3) */
  smsRateLimit?: WorkspaceSmsRateLimitSettings;
  /** Email rate limiting configuration (Phase P) */
  emailRateLimit?: WorkspaceEmailRateLimitSettings;
  /** Email compliance configuration (Phase P) */
  emailCompliance?: WorkspaceEmailComplianceSettings;
  /** Sandbox mode configuration (intercepts outbound comms for demo/onboarding) */
  sandbox?: WorkspaceSandboxSettings;
}
