/**
 * Voice Settings Schema
 * Global and project-level voice preferences
 */

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { voices } from './voices';
import { projects } from './projects';
import { models } from './models';

/**
 * Global Voice Settings (singleton)
 * Default voice settings for all projects
 */
export const globalVoiceSettings = pgTable('global_voice_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userVoiceId: uuid('user_voice_id')
    .notNull()
    .references(() => voices.id, { onDelete: 'restrict' }),
  assistantVoiceId: uuid('assistant_voice_id')
    .notNull()
    .references(() => voices.id, { onDelete: 'restrict' }),
  modelId: uuid('model_id').references(() => models.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Project Voice Settings
 * Overrides for specific projects
 */
export const projectVoiceSettings = pgTable('project_voice_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userVoiceId: uuid('user_voice_id').references(() => voices.id, { onDelete: 'restrict' }),
  assistantVoiceId: uuid('assistant_voice_id').references(() => voices.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const globalVoiceSettingsRelations = relations(globalVoiceSettings, ({ one }) => ({
  userVoice: one(voices, {
    fields: [globalVoiceSettings.userVoiceId],
    references: [voices.id],
    relationName: 'globalUserVoice',
  }),
  assistantVoice: one(voices, {
    fields: [globalVoiceSettings.assistantVoiceId],
    references: [voices.id],
    relationName: 'globalAssistantVoice',
  }),
  model: one(models, {
    fields: [globalVoiceSettings.modelId],
    references: [models.id],
  }),
}));

export const projectVoiceSettingsRelations = relations(projectVoiceSettings, ({ one }) => ({
  project: one(projects, {
    fields: [projectVoiceSettings.projectId],
    references: [projects.id],
  }),
  userVoice: one(voices, {
    fields: [projectVoiceSettings.userVoiceId],
    references: [voices.id],
    relationName: 'projectUserVoice',
  }),
  assistantVoice: one(voices, {
    fields: [projectVoiceSettings.assistantVoiceId],
    references: [voices.id],
    relationName: 'projectAssistantVoice',
  }),
}));

export type GlobalVoiceSettings = typeof globalVoiceSettings.$inferSelect;
export type NewGlobalVoiceSettings = typeof globalVoiceSettings.$inferInsert;
export type ProjectVoiceSettings = typeof projectVoiceSettings.$inferSelect;
export type NewProjectVoiceSettings = typeof projectVoiceSettings.$inferInsert;
