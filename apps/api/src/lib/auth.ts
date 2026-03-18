/**
 * API Key Authentication
 *
 * Validates API keys using bcrypt (same as admin app)
 * Also validates JWT tokens for end-user authentication
 */

import bcrypt from 'bcryptjs';
import { sql } from './db';
import { connectionManager } from './connection-manager';
import { extractProjectId, verifyToken, isTokenRevoked } from './jwt';
import type { ApiContext } from '../types';

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check query param (for SSE/WebSocket connections)
  const url = new URL(req.url);
  const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key');
  if (queryKey) {
    return queryKey;
  }

  return null;
}

/**
 * Validate API key and return context
 */
export async function validateApiKey(req: Request): Promise<ApiContext | null> {
  const apiKey = extractApiKey(req);

  console.debug('[auth] Validating API key, found:', apiKey?.substring(0, 20));

  if (!apiKey || !apiKey.startsWith('sk_')) {
    console.debug('[auth] No valid API key found');
    return null;
  }

  // Extract prefix (first 12 chars: "sk_live_XXXX")
  const prefix = apiKey.substring(0, 12);
  console.debug('[auth] Looking up key prefix:', prefix);

  // Look up key by prefix, join with projects and project_databases to get tier info
  const result = await sql`
    SELECT
      ak.id as key_id,
      ak.org_id,
      ak.project_id,
      p.org_id as project_org_id,
      p.schema_name,
      pd.schema_name as pd_schema_name,
      di.tier,
      ak.key_hash,
      ak.scopes,
      ak.revoked_at,
      ak.expires_at
    FROM api_keys ak
    LEFT JOIN projects p ON p.id = ak.project_id
    LEFT JOIN project_databases pd ON pd.project_id = ak.project_id
    LEFT JOIN database_instances di ON di.id = pd.instance_id
    JOIN organizations o ON o.id = ak.org_id
    WHERE ak.key_prefix = ${prefix}
    LIMIT 1
  `;

  console.debug('[auth] Query result count:', result.length);
  if (result.length === 0) {
    console.debug('[auth] No key found for prefix');
    return null;
  }

  const key = result[0];
  console.debug('[auth] Found key:', key.key_id, 'project:', key.project_id);

  // Check if key is revoked
  if (key.revoked_at) {
    console.debug('[auth] Key is revoked');
    return null;
  }

  // Check if key is expired
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    console.debug('[auth] Key is expired');
    return null;
  }

  // Verify the full key with bcrypt
  const valid = await bcrypt.compare(apiKey, key.key_hash);
  console.debug('[auth] Bcrypt validation:', valid);
  if (!valid) {
    console.debug('[auth] Invalid key hash');
    return null;
  }

  // Require project_id for API access
  if (!key.project_id) {
    console.warn(`[auth] API key ${key.key_id} has no project_id, access denied`);
    return null;
  }

  // Get tier - default to 'hobbyist' if not in project_databases yet
  const tier = key.tier || 'hobbyist';

  // For hobbyist tier, require schema_name (schema isolation)
  // For pro/business/enterprise tier, schema_name is null (database/instance isolation)
  const schemaName = key.pd_schema_name || key.schema_name;
  if ((tier === 'hobbyist' || tier === 'free') && !schemaName) {
    console.warn(`[auth] ${tier} tier project ${key.project_id} has no schema_name, access denied`);
    return null;
  }

  // Update last used timestamp (fire and forget)
  sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${key.key_id}`.catch(() => {});

  return {
    orgId: key.org_id,
    projectId: key.project_id,
    schemaName: schemaName || null,
    tier,
    keyId: key.key_id,
    scopes: key.scopes || ['read', 'write', 'realtime'],
    authType: 'api_key' as const,
  };
}

/**
 * Check if context has required scope
 */
export function requireScope(ctx: ApiContext, scope: string): boolean {
  return ctx.scopes.includes(scope);
}

/**
 * Get project's JWT secret for token signing/verification
 */
export async function getProjectJwtSecret(projectId: string): Promise<string | null> {
  const result = await sql`
    SELECT jwt_secret FROM projects WHERE id = ${projectId}
  `;

  if (result.length === 0 || !result[0].jwt_secret) {
    return null;
  }

  return result[0].jwt_secret;
}

/**
 * Get project info for building ApiContext
 */
async function getProjectInfo(projectId: string): Promise<{
  orgId: string;
  schemaName: string | null;
  tier: string;
} | null> {
  // Try to get full info from project_databases (for properly configured projects)
  const result = await sql`
    SELECT
      p.org_id,
      pd.schema_name,
      COALESCE(di.tier, 'hobbyist') as tier
    FROM projects p
    LEFT JOIN project_databases pd ON pd.project_id = p.id AND pd.status = 'active'
    LEFT JOIN database_instances di ON di.id = pd.instance_id
    WHERE p.id = ${projectId}
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    orgId: row.org_id,
    schemaName: row.schema_name || null,
    tier: row.tier || 'hobbyist',
  };
}

/**
 * Validate JWT token and return context
 *
 * JWT tokens are scoped tokens created via POST /v1/tokens.
 * They contain:
 * - pid: project ID
 * - sub: end-user identifier (optional)
 * - scopes: custom scopes for RLS filtering
 * - jti: unique token ID for revocation
 */
export async function validateJwtToken(token: string): Promise<ApiContext | null> {
  try {
    // 1. Extract project ID from token (without verification)
    const projectId = extractProjectId(token);
    if (!projectId) {
      console.debug('[auth] JWT missing project ID (pid claim)');
      return null;
    }

    // 2. Get project's JWT secret
    const jwtSecret = await getProjectJwtSecret(projectId);
    if (!jwtSecret) {
      console.debug('[auth] Project JWT secret not configured');
      return null;
    }

    // 3. Verify JWT signature and expiration
    const claims = await verifyToken(token, jwtSecret);
    if (!claims) {
      console.debug('[auth] JWT verification failed');
      return null;
    }

    // 4. Get project info for context
    const projectInfo = await getProjectInfo(projectId);
    if (!projectInfo) {
      console.debug('[auth] Project not found');
      return null;
    }

    // 5. Get database connection and check revocation
    // Use main db with schema for hobbyist, or connection manager for pro/enterprise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let projectSql: any;
    let schema: string | null = null;

    if ((projectInfo.tier === 'hobbyist' || projectInfo.tier === 'free') && projectInfo.schemaName) {
      // Hobbyist/free tier: use main database with schema isolation
      projectSql = sql;
      schema = projectInfo.schemaName;
    } else {
      try {
        const conn = await connectionManager.getPool(projectId);
        projectSql = conn.sql;
        schema = conn.schema;
      } catch {
        // Fall back to main db with schema if connection manager fails
        if (projectInfo.schemaName) {
          projectSql = sql;
          schema = projectInfo.schemaName;
        } else {
          console.debug('[auth] Cannot get database connection for project');
          return null;
        }
      }
    }

    // 6. Check if token is revoked
    const revoked = await isTokenRevoked(claims.jti, projectSql, schema);
    if (revoked) {
      console.debug('[auth] JWT token is revoked or not found in database');
      return null;
    }

    // 7. Return ApiContext with JWT-specific fields
    return {
      orgId: projectInfo.orgId,
      projectId,
      schemaName: projectInfo.schemaName,
      tier: projectInfo.tier,
      keyId: claims.jti, // Use JTI as key identifier for rate limiting etc.
      scopes: ['read', 'write', 'realtime'], // JWT tokens get full data access
      authType: 'jwt' as const,
      userId: claims.sub,
      tokenScopes: claims.scopes,
      tokenJti: claims.jti,
    };
  } catch (error) {
    console.error('[auth] JWT validation error:', error);
    return null;
  }
}
