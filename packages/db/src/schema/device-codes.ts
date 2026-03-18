/**
 * Device Codes Schema
 * For device authentication flow (OAuth device flow)
 */

import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const deviceCodes = pgTable('device_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceCode: text('device_code').notNull().unique(),
  userCode: text('user_code').notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  confirmed: boolean('confirmed').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DeviceCode = typeof deviceCodes.$inferSelect;
export type NewDeviceCode = typeof deviceCodes.$inferInsert;
