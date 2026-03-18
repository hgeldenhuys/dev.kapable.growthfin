/**
 * Scoped Token Routes
 *
 * Endpoints for managing JWT tokens with custom scopes for end-user RLS:
 * - POST /v1/tokens - Create a new scoped token
 * - GET /v1/tokens - List tokens (with optional ?sub= filter)
 * - DELETE /v1/tokens/:id - Revoke a token
 */

import { connectionManager, RemoteDataError } from '../lib/connection-manager';
import { sql as mainSql } from '../lib/db';
import { signToken } from '../lib/jwt';
import { getProjectJwtSecret } from '../lib/auth';
import type { ApiContext, CreateTokenRequest, TokenListItem } from '../types';
import type { Sql } from 'postgres';

/**
 * Get database connection for token operations
 * Falls back to main database with schema isolation for hobbyist/free tier
 */
async function getTokensConnection(ctx: ApiContext): Promise<{ sql: Sql; schema: string | null; tier: string }> {
  // For hobbyist/free tier with schema isolation, use main database directly
  // This avoids needing project_databases entries for simple setups
  if ((ctx.tier === 'hobbyist' || ctx.tier === 'free') && ctx.schemaName) {
    return { sql: mainSql, schema: ctx.schemaName, tier: ctx.tier };
  }

  try {
    return await connectionManager.getPool(ctx.projectId);
  } catch (error) {
    // Fall back to main database if project_databases entry doesn't exist
    if (error instanceof Error && error.message.includes('No database found')) {
      if (ctx.schemaName) {
        return { sql: mainSql, schema: ctx.schemaName, tier: ctx.tier };
      }
    }
    throw error;
  }
}

// Maximum scopes object size to prevent oversized tokens
const MAX_SCOPES_SIZE = 4096;

// Maximum array size within scopes
const MAX_ARRAY_SIZE = 100;

/**
 * Validate scopes object
 */
function validateScopes(scopes: Record<string, unknown>): { valid: boolean; error?: string } {
  // Check overall size
  const scopesStr = JSON.stringify(scopes);
  if (scopesStr.length > MAX_SCOPES_SIZE) {
    return { valid: false, error: `Scopes object too large (max ${MAX_SCOPES_SIZE} bytes)` };
  }

  // Check array sizes
  for (const [key, value] of Object.entries(scopes)) {
    if (Array.isArray(value) && value.length > MAX_ARRAY_SIZE) {
      return { valid: false, error: `Array '${key}' too large (max ${MAX_ARRAY_SIZE} items)` };
    }
  }

  return { valid: true };
}

/**
 * POST /v1/tokens - Create a new scoped token
 *
 * Body:
 * {
 *   "sub": "user-123",           // Optional: end-user identifier
 *   "scopes": {                   // Optional: custom scopes for RLS
 *     "roles": ["admin", "editor"],
 *     "team_id": "sales"
 *   },
 *   "expires_in": 86400          // Optional: expiry in seconds (default: 24h, max: 30d)
 * }
 *
 * Response:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIs...",
 *   "token_id": "tok_abc123",
 *   "expires_at": "2026-01-21T12:00:00Z"
 * }
 */
export async function createToken(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  // Parse request body
  let body: CreateTokenRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate scopes if provided
  if (body.scopes) {
    if (typeof body.scopes !== 'object' || Array.isArray(body.scopes)) {
      return Response.json({ error: 'Scopes must be an object' }, { status: 400 });
    }

    const scopesValidation = validateScopes(body.scopes);
    if (!scopesValidation.valid) {
      return Response.json({ error: scopesValidation.error }, { status: 400 });
    }
  }

  // Validate expires_in
  if (body.expires_in !== undefined) {
    if (typeof body.expires_in !== 'number' || body.expires_in <= 0) {
      return Response.json({ error: 'expires_in must be a positive number' }, { status: 400 });
    }

    const maxExpiry = 30 * 24 * 60 * 60; // 30 days
    if (body.expires_in > maxExpiry) {
      return Response.json({
        error: `expires_in exceeds maximum of ${maxExpiry} seconds (30 days)`
      }, { status: 400 });
    }
  }

  try {
    // Get project's JWT secret
    const jwtSecret = await getProjectJwtSecret(ctx.projectId);
    if (!jwtSecret) {
      return Response.json({ error: 'Project JWT secret not configured' }, { status: 500 });
    }

    // Sign the token
    const { token, jti, expiresAt } = await signToken(ctx.projectId, jwtSecret, body);

    // Store token record in database
    const { sql: projectSql, schema } = await getTokensConnection(ctx);
    // Use schema when provided (for hobbyist/free tier with schema isolation)
    const useSchema = !!schema;

    const tokensRef = useSchema ? `"${schema}"."_tokens"` : '"_tokens"';

    await projectSql.unsafe(
      `INSERT INTO ${tokensRef} (jti, sub, scopes, expires_at, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [jti, body.sub || null, JSON.stringify(body.scopes || {}), expiresAt, ctx.keyId]
    );

    return Response.json({
      token,
      token_id: jti,
      expires_at: expiresAt.toISOString(),
    }, { status: 201 });

  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }

    console.error('[tokens] Error creating token:', error);
    return Response.json({ error: 'Failed to create token' }, { status: 500 });
  }
}

/**
 * GET /v1/tokens - List tokens
 *
 * Query params:
 * - sub: Filter by subject (optional)
 * - limit: Max results (default: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "tok_abc123",
 *       "sub": "user-123",
 *       "scopes": { "roles": ["member"] },
 *       "expires_at": "2026-01-21T12:00:00Z",
 *       "created_at": "2026-01-20T12:00:00Z",
 *       "revoked": false
 *     }
 *   ],
 *   "total": 42
 * }
 */
export async function listTokens(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const url = new URL(req.url);
  const sub = url.searchParams.get('sub');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const { sql: projectSql, schema } = await getTokensConnection(ctx);
    // Use schema when provided (for hobbyist/free tier with schema isolation)
    const useSchema = !!schema;

    const tokensRef = useSchema ? `"${schema}"."_tokens"` : '"_tokens"';

    // Build query
    let whereClause = '';
    const queryParams: unknown[] = [];

    if (sub) {
      whereClause = 'WHERE sub = $1';
      queryParams.push(sub);
    }

    // Get total count
    const countResult = await projectSql.unsafe(
      `SELECT COUNT(*) as total FROM ${tokensRef} ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult[0]?.total || '0');

    // Get tokens
    const limitOffset = sub
      ? `LIMIT $2 OFFSET $3`
      : `LIMIT $1 OFFSET $2`;

    const listParams = sub
      ? [...queryParams, limit, offset]
      : [limit, offset];

    const tokens = await projectSql.unsafe(
      `SELECT jti, sub, scopes, expires_at, revoked_at, created_at
       FROM ${tokensRef}
       ${whereClause}
       ORDER BY created_at DESC
       ${limitOffset}`,
      listParams
    );

    const data: TokenListItem[] = tokens.map(t => ({
      id: t.jti,
      sub: t.sub,
      scopes: typeof t.scopes === 'string' ? JSON.parse(t.scopes) : t.scopes,
      expires_at: t.expires_at instanceof Date
        ? t.expires_at.toISOString()
        : t.expires_at,
      created_at: t.created_at instanceof Date
        ? t.created_at.toISOString()
        : t.created_at,
      revoked: t.revoked_at !== null,
    }));

    return Response.json({ data, total });

  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }

    console.error('[tokens] Error listing tokens:', error);
    return Response.json({ error: 'Failed to list tokens' }, { status: 500 });
  }
}

/**
 * DELETE /v1/tokens/:id - Revoke a token
 *
 * Response: 204 No Content
 */
export async function revokeToken(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  if (!id || !id.startsWith('tok_')) {
    return Response.json({ error: 'Invalid token ID' }, { status: 400 });
  }

  try {
    const { sql: projectSql, schema } = await getTokensConnection(ctx);
    // Use schema when provided (for hobbyist/free tier with schema isolation)
    const useSchema = !!schema;

    const tokensRef = useSchema ? `"${schema}"."_tokens"` : '"_tokens"';

    // Set revoked_at timestamp
    const result = await projectSql.unsafe(
      `UPDATE ${tokensRef}
       SET revoked_at = NOW()
       WHERE jti = $1 AND revoked_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.length === 0) {
      // Check if token exists at all
      const exists = await projectSql.unsafe(
        `SELECT 1 FROM ${tokensRef} WHERE jti = $1`,
        [id]
      );

      if (exists.length === 0) {
        return Response.json({ error: 'Token not found' }, { status: 404 });
      }

      // Token exists but was already revoked
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 204 });

  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }

    console.error('[tokens] Error revoking token:', error);
    return Response.json({ error: 'Failed to revoke token' }, { status: 500 });
  }
}

/**
 * GET /v1/tokens/:id - Get token details
 *
 * Response:
 * {
 *   "id": "tok_abc123",
 *   "sub": "user-123",
 *   "scopes": { "roles": ["member"] },
 *   "expires_at": "2026-01-21T12:00:00Z",
 *   "created_at": "2026-01-20T12:00:00Z",
 *   "revoked": false
 * }
 */
export async function getToken(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { id } = params;

  if (!id || !id.startsWith('tok_')) {
    return Response.json({ error: 'Invalid token ID' }, { status: 400 });
  }

  try {
    const { sql: projectSql, schema } = await getTokensConnection(ctx);
    // Use schema when provided (for hobbyist/free tier with schema isolation)
    const useSchema = !!schema;

    const tokensRef = useSchema ? `"${schema}"."_tokens"` : '"_tokens"';

    const result = await projectSql.unsafe(
      `SELECT jti, sub, scopes, expires_at, revoked_at, created_at
       FROM ${tokensRef}
       WHERE jti = $1`,
      [id]
    );

    if (result.length === 0) {
      return Response.json({ error: 'Token not found' }, { status: 404 });
    }

    const t = result[0];
    return Response.json({
      id: t.jti,
      sub: t.sub,
      scopes: typeof t.scopes === 'string' ? JSON.parse(t.scopes) : t.scopes,
      expires_at: t.expires_at instanceof Date
        ? t.expires_at.toISOString()
        : t.expires_at,
      created_at: t.created_at instanceof Date
        ? t.created_at.toISOString()
        : t.created_at,
      revoked: t.revoked_at !== null,
    });

  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }

    console.error('[tokens] Error getting token:', error);
    return Response.json({ error: 'Failed to get token' }, { status: 500 });
  }
}
