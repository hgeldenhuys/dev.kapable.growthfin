/**
 * Personas Schema
 * Agent identities with specialized roles and skills
 */

import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects';

/**
 * Suggested persona roles (not enforced at DB level for flexibility)
 * You can use these or create your own custom roles
 */
export const PERSONA_ROLES = {
  GENERALIST: 'generalist',
  ARCHITECT: 'architect',
  DEVELOPER: 'developer',
  QA: 'qa',
  ANALYST: 'analyst',
  DEVOPS: 'devops',
} as const;

export type PersonaRole = typeof PERSONA_ROLES[keyof typeof PERSONA_ROLES] | string;

export const personas = pgTable(
  'personas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(), // URL-safe identifier for env var reference
    role: text('role').notNull(), // Flexible - any text value allowed
    color: text('color').notNull(), // Hex color for visual identification (e.g., "#3B82F6")
    voice: text('voice'), // Voice identifier for TTS system
    description: text('description'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('personas_project_id_idx').on(table.projectId),
    projectDefaultIdx: index('personas_project_default_idx').on(table.projectId, table.isDefault),
    projectSlugIdx: index('personas_project_slug_idx').on(table.projectId, table.slug),
  })
);

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;

/**
 * Persona Skills Junction Table
 * Links personas to their skill files in .claude/agents/*.md
 */
export const personaSkills = pgTable(
  'persona_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
    skillName: text('skill_name').notNull(), // File name in .claude/agents/ (e.g., "ui-qa-tester")
    priority: integer('priority').notNull().default(0), // Load order (lower = higher priority)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    personaIdIdx: index('persona_skills_persona_id_idx').on(table.personaId),
    priorityIdx: index('persona_skills_priority_idx').on(table.personaId, table.priority),
  })
);

export type PersonaSkill = typeof personaSkills.$inferSelect;
export type NewPersonaSkill = typeof personaSkills.$inferInsert;
