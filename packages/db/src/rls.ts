/**
 * Row Level Security (RLS) Utilities
 * Helpers for setting and managing RLS context
 */

import { sql } from 'drizzle-orm';
import type { Database } from './client';

export interface RLSContext {
  userId: string;
  workspaceId: string;
}

/**
 * Set RLS context for the current transaction
 * This sets PostgreSQL session variables that RLS policies use
 */
export async function setRLSContext(db: Database, context: RLSContext): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config('app.user_id', ${context.userId}, true),
      set_config('app.workspace_id', ${context.workspaceId}, true);
  `);
}

/**
 * Clear RLS context
 */
export async function clearRLSContext(db: Database): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config('app.user_id', NULL, true),
      set_config('app.workspace_id', NULL, true);
  `);
}

/**
 * Execute a query with RLS context
 * Automatically sets and clears context
 */
export async function withRLSContext<T>(
  db: Database,
  context: RLSContext,
  fn: (db: Database) => Promise<T>
): Promise<T> {
  try {
    await setRLSContext(db, context);
    return await fn(db);
  } finally {
    await clearRLSContext(db);
  }
}

/**
 * Create RLS policies SQL (to be run after schema push)
 * This creates the actual PostgreSQL RLS policies
 */
export const createRLSPoliciesSQL = sql`
-- RLS Policies for Workspaces
CREATE POLICY "Users can view workspaces they own or are members of"
  ON workspaces FOR SELECT
  USING (
    owner_id = current_setting('app.user_id', true)::uuid
    OR id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY "Users can insert their own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY "Workspace owners can update their workspaces"
  ON workspaces FOR UPDATE
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY "Workspace owners can delete their workspaces"
  ON workspaces FOR DELETE
  USING (owner_id = current_setting('app.user_id', true)::uuid);

-- RLS Policies for Workspace Members
CREATE POLICY "Users can view members of their workspaces"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE owner_id = current_setting('app.user_id', true)::uuid
        OR id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = current_setting('app.user_id', true)::uuid
        )
    )
  );

CREATE POLICY "Workspace owners and admins can manage members"
  ON workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id', true)::uuid
        AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for Hook Events
CREATE POLICY "Users can view hook events from their workspaces"
  ON hook_events FOR SELECT
  USING (
    workspace_id = current_setting('app.workspace_id', true)::uuid
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY "Users can insert hook events to their active workspace"
  ON hook_events FOR INSERT
  WITH CHECK (
    workspace_id = current_setting('app.workspace_id', true)::uuid
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY "Workspace admins can update hook events"
  ON hook_events FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id', true)::uuid
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Workspace owners can delete hook events"
  ON hook_events FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id', true)::uuid
        AND role = 'owner'
    )
  );
`;
