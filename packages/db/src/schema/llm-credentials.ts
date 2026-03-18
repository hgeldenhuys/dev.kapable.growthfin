/**
 * LLM Credentials Schema
 * Encrypted API keys for LLM providers
 */

import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { users } from './users';
import type { LLMProvider } from './llm-configs';

export const llmCredentials = pgTable(
  'llm_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // e.g., "My OpenAI Key", "Company Anthropic Key"
    provider: text('provider').notNull().$type<LLMProvider>(),

    // Encrypted API key (AES-256-GCM)
    // Format: iv:authTag:encryptedData (all hex-encoded)
    apiKeyEncrypted: text('api_key_encrypted').notNull(),

    // Ownership hierarchy (NULL = system-level)
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }), // NULL = system
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // NULL = workspace-level

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('llm_credentials_provider_idx').on(table.provider),
    workspaceIdIdx: index('llm_credentials_workspace_id_idx').on(table.workspaceId),
    userIdIdx: index('llm_credentials_user_id_idx').on(table.userId),
  })
);

export type LLMCredential = typeof llmCredentials.$inferSelect;
export type NewLLMCredential = typeof llmCredentials.$inferInsert;

/**
 * Ownership Levels:
 *
 * 1. System-level (workspaceId = NULL, userId = NULL)
 *    - Used for bootstrapping and default credentials
 *    - Set by system administrators
 *
 * 2. Workspace-level (workspaceId set, userId = NULL)
 *    - Shared by all users in workspace
 *    - Set by workspace owners/admins
 *
 * 3. User-level (workspaceId set, userId set)
 *    - Personal API keys
 *    - User brings their own key (BYOK)
 */
