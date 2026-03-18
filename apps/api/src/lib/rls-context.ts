/**
 * RLS Context Helper
 *
 * Sets PostgreSQL session variables for Row-Level Security policies.
 * When using JWT tokens, these variables are used by RLS policies to
 * filter data based on the token's claims.
 *
 * Session variables available in RLS policies:
 * - current_setting('app.user_id') - The user ID (from JWT 'sub' claim)
 * - current_setting('app.scopes') - JSON object of scopes
 * - current_setting('app.auth_type') - 'jwt' or 'api_key'
 *
 * Example RLS policy:
 * CREATE POLICY user_data_policy ON my_table
 *   FOR ALL USING (
 *     current_setting('app.auth_type', true) = 'api_key' OR
 *     user_id = current_setting('app.user_id', true) OR
 *     (current_setting('app.scopes', true)::jsonb->>'team_id')::text = team_id
 *   );
 */

import type { Sql } from 'postgres';
import type { ApiContext } from '../types';
import { trackDbQueryStart, trackDbQueryEnd } from './usage';

/**
 * Set RLS context variables in the database session
 *
 * These variables are set using SET LOCAL, which means they are
 * only valid for the current transaction. This ensures isolation
 * between requests.
 *
 * @param sql - Database connection
 * @param ctx - API context with auth info
 */
export async function setTokenRLS(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  ctx: ApiContext
): Promise<void> {
  // For JWT tokens, set all relevant session variables
  if (ctx.authType === 'jwt') {
    const userId = ctx.userId || '';
    const scopes = JSON.stringify(ctx.tokenScopes || {});
    const authType = 'jwt';

    // Use SET LOCAL to scope variables to current transaction
    // These will be automatically cleared when the transaction ends
    await sql.unsafe(`
      SELECT
        set_config('app.user_id', $1, true),
        set_config('app.scopes', $2, true),
        set_config('app.auth_type', $3, true)
    `, [userId, scopes, authType]);
  } else {
    // For API keys, set auth_type but clear user-specific variables
    // This signals to RLS policies that full access should be granted
    await sql.unsafe(`
      SELECT
        set_config('app.user_id', '', true),
        set_config('app.scopes', '{}', true),
        set_config('app.auth_type', 'api_key', true)
    `);
  }
}

/**
 * Execute a query with RLS context set
 *
 * Wraps a query function in a transaction with RLS variables set.
 * The variables are automatically cleared when the transaction completes.
 *
 * @param sql - Database connection (from connection manager)
 * @param ctx - API context with auth info
 * @param queryFn - Function that executes the query
 * @returns Query result
 */
export async function withTokenRLS<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  ctx: ApiContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: (txSql: any) => Promise<T>
): Promise<T> {
  // Track database query for usage metrics
  trackDbQueryStart(ctx.orgId);

  try {
    // Only set RLS context for JWT tokens
    // API keys get full access (no filtering)
    if (ctx.authType === 'jwt') {
      return await sql.begin(async (tx: any) => {
        // Switch to non-superuser role so RLS policies are enforced
        // (Superusers bypass RLS even with FORCE ROW LEVEL SECURITY)
        await tx.unsafe('SET ROLE signaldb_api');

        // Set RLS variables
        const userId = ctx.userId || '';
        const scopes = JSON.stringify(ctx.tokenScopes || {});

        await tx.unsafe(`
          SELECT
            set_config('app.user_id', $1, true),
            set_config('app.scopes', $2, true),
            set_config('app.auth_type', 'jwt', true)
        `, [userId, scopes]);

        // Execute the query with RLS context active, passing transaction connection
        return queryFn(tx);
      }) as T;
    }

    // For API keys, execute without RLS context
    // Pass the original sql connection
    return await queryFn(sql);
  } finally {
    // Always track query end, even on error
    trackDbQueryEnd(ctx.orgId);
  }
}

/**
 * Check if RLS filtering should be applied
 *
 * @param ctx - API context
 * @returns true if JWT auth (RLS should filter), false for API key (full access)
 */
export function shouldApplyRLS(ctx: ApiContext): boolean {
  return ctx.authType === 'jwt';
}
