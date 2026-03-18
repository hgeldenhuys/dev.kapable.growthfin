/**
 * Calendar & Meeting Booking Schema (Phase S)
 * Three tables: calendar connections, meetings, and booking links
 *
 * Supports:
 * - OAuth connections to external calendars (Google, Outlook, Apple)
 * - Meeting/appointment CRUD with CRM entity linking
 * - Public booking links with availability management
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

// ============================================================================
// CALENDAR CONNECTIONS TABLE
// ============================================================================

export const crmCalendarConnections = pgTable(
  'crm_calendar_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // User who owns this connection
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Provider info
    provider: text('provider').notNull(), // 'google_calendar' | 'outlook' | 'apple'
    accessToken: text('access_token').notNull(), // encrypted
    refreshToken: text('refresh_token'), // encrypted
    externalAccountId: text('external_account_id'), // e.g., Google account email
    externalCalendarId: text('external_calendar_id'), // specific calendar ID

    // Sync state
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    syncStatus: text('sync_status').notNull().default('active'), // 'active' | 'error' | 'disconnected'
    syncError: text('sync_error'),

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Index for workspace lookups
    workspaceIdx: index('crm_cal_conn_workspace_idx').on(table.workspaceId),
    // Index for user lookups
    userIdx: index('crm_cal_conn_user_idx').on(table.userId),
    // Index for sync status queries
    syncStatusIdx: index('crm_cal_conn_sync_status_idx').on(table.syncStatus),
  })
);

// Relations
export const crmCalendarConnectionsRelations = relations(crmCalendarConnections, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmCalendarConnections.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [crmCalendarConnections.userId],
    references: [users.id],
  }),
}));

// Types
export type CrmCalendarConnection = typeof crmCalendarConnections.$inferSelect;
export type NewCrmCalendarConnection = typeof crmCalendarConnections.$inferInsert;

export type CalendarProvider = 'google_calendar' | 'outlook' | 'apple';
export type CalendarSyncStatus = 'active' | 'error' | 'disconnected';

// ============================================================================
// MEETINGS TABLE
// ============================================================================

export const crmMeetings = pgTable(
  'crm_meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Meeting details
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    location: text('location'), // physical location or virtual link
    meetingUrl: text('meeting_url'), // video call link

    // Status
    status: text('status').notNull().default('scheduled'), // 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
    type: text('type').notNull().default('video'), // 'call' | 'video' | 'in_person' | 'other'

    // Organizer
    organizerId: uuid('organizer_id')
      .references(() => users.id),

    // CRM entity references
    leadId: uuid('lead_id'),
    contactId: uuid('contact_id'),
    opportunityId: uuid('opportunity_id'),
    accountId: uuid('account_id'),

    // External calendar sync
    externalEventId: text('external_event_id'), // Google Calendar event ID
    calendarConnectionId: uuid('calendar_connection_id')
      .references(() => crmCalendarConnections.id),

    // Additional info
    notes: text('notes'),
    outcome: text('outcome'),

    // Booking link reference
    bookingLinkId: uuid('booking_link_id'),

    // Reminder tracking
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Workspace lookups
    workspaceIdx: index('crm_meetings_workspace_idx').on(table.workspaceId),
    // Organizer lookups
    organizerIdx: index('crm_meetings_organizer_idx').on(table.organizerId),
    // CRM entity lookups
    leadIdx: index('crm_meetings_lead_idx').on(table.leadId),
    contactIdx: index('crm_meetings_contact_idx').on(table.contactId),
    opportunityIdx: index('crm_meetings_opportunity_idx').on(table.opportunityId),
    // Time-based queries
    startTimeIdx: index('crm_meetings_start_time_idx').on(table.startTime),
    // Status queries
    statusIdx: index('crm_meetings_status_idx').on(table.status),
  })
);

// Relations
export const crmMeetingsRelations = relations(crmMeetings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmMeetings.workspaceId],
    references: [workspaces.id],
  }),
  organizer: one(users, {
    fields: [crmMeetings.organizerId],
    references: [users.id],
  }),
  calendarConnection: one(crmCalendarConnections, {
    fields: [crmMeetings.calendarConnectionId],
    references: [crmCalendarConnections.id],
  }),
}));

// Types
export type CrmMeeting = typeof crmMeetings.$inferSelect;
export type NewCrmMeeting = typeof crmMeetings.$inferInsert;

export type MeetingStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type MeetingType = 'call' | 'video' | 'in_person' | 'other';

// ============================================================================
// BOOKING LINKS TABLE
// ============================================================================

export const crmBookingLinks = pgTable(
  'crm_booking_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Owner of the booking link
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Booking link identity
    slug: text('slug').notNull(), // URL-friendly identifier
    title: text('title').notNull(),
    description: text('description'),

    // Scheduling configuration
    durationMinutes: integer('duration_minutes').notNull().default(30),
    bufferMinutes: integer('buffer_minutes').notNull().default(15), // time between meetings
    availableHours: jsonb('available_hours'), // e.g., { mon: [{start: "09:00", end: "17:00"}], ... }
    timezone: text('timezone').notNull().default('UTC'),

    // Availability constraints
    isActive: boolean('is_active').notNull().default(true),
    maxBookingsPerDay: integer('max_bookings_per_day').notNull().default(8),
    minNoticeHours: integer('min_notice_hours').notNull().default(24), // minimum advance notice
    maxAdvanceDays: integer('max_advance_days').notNull().default(30), // how far ahead to allow booking

    // Notifications
    confirmationEmailEnabled: boolean('confirmation_email_enabled').notNull().default(true),
    reminderEmailEnabled: boolean('reminder_email_enabled').notNull().default(true),
    reminderMinutesBefore: integer('reminder_minutes_before').notNull().default(60),

    // Custom form fields for booking
    customFields: jsonb('custom_fields'), // additional form fields

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Unique slug globally
    slugUniqueIdx: uniqueIndex('crm_booking_links_slug_unique_idx').on(table.slug),
    // Workspace lookups
    workspaceIdx: index('crm_booking_links_workspace_idx').on(table.workspaceId),
    // User lookups
    userIdx: index('crm_booking_links_user_idx').on(table.userId),
    // Active status lookups
    isActiveIdx: index('crm_booking_links_active_idx').on(table.isActive),
  })
);

// Relations
export const crmBookingLinksRelations = relations(crmBookingLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmBookingLinks.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [crmBookingLinks.userId],
    references: [users.id],
  }),
}));

// Types
export type CrmBookingLink = typeof crmBookingLinks.$inferSelect;
export type NewCrmBookingLink = typeof crmBookingLinks.$inferInsert;

export type AvailableHours = Record<string, Array<{ start: string; end: string }>>;
