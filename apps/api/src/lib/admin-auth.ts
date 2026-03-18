/**
 * Admin API Key Authentication for Management API
 *
 * Validates org-level admin keys (sk_admin_*) for managing projects and API keys
 */

import bcrypt from 'bcryptjs';
import { sql } from './db';

export interface AdminContext {
  orgId: string;
  keyId: string;
  scopes: string[];
}

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

  return null;
}

/**
 * Validate admin API key and return context
 */
export async function validateAdminKey(req: Request): Promise<AdminContext | null> {
  const apiKey = extractApiKey(req);

  if (!apiKey || !apiKey.startsWith('sk_admin_')) {
    return null;
  }

  // Extract prefix (first 12 chars: "sk_admin_XXX")
  const prefix = apiKey.substring(0, 12);

  // Look up key by prefix
  const result = await sql`
    SELECT
      ak.id as key_id,
      ak.org_id,
      ak.key_hash,
      ak.key_type,
      ak.scopes,
      ak.revoked_at,
      ak.expires_at
    FROM api_keys ak
    JOIN organizations o ON o.id = ak.org_id
    WHERE ak.key_prefix = ${prefix}
      AND ak.key_type = 'admin'
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const key = result[0];

  // Check if key is revoked
  if (key.revoked_at) {
    return null;
  }

  // Check if key is expired
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return null;
  }

  // Verify the full key with bcrypt
  const valid = await bcrypt.compare(apiKey, key.key_hash);
  if (!valid) {
    return null;
  }

  // Update last used timestamp (fire and forget)
  sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${key.key_id}`.catch(() => {});

  return {
    orgId: key.org_id,
    keyId: key.key_id,
    scopes: key.scopes || ['manage:projects', 'manage:keys', 'read:usage', 'manage:apps'],
  };
}

/**
 * Check if admin context has required scope
 */
export function requireAdminScope(ctx: AdminContext, scope: string): boolean {
  return ctx.scopes.includes(scope);
}

/**
 * Validate internal admin request from admin dashboard or console
 * Supports two auth methods:
 *   1. X-Internal-Admin + X-Admin-Org-Id (admin panel)
 *   2. X-Deploy-Secret + X-Org-Id (console deploy/management calls)
 */
export async function validateInternalAdminRequest(req: Request): Promise<AdminContext | null> {
  let orgId: string | null = null;

  // Method 1: Internal admin header (admin panel)
  const isInternal = req.headers.get('X-Internal-Admin') === 'true';
  if (isInternal) {
    orgId = req.headers.get('X-Admin-Org-Id');
  }

  // Method 2: Deploy secret (console)
  if (!orgId) {
    const secret = req.headers.get('X-Deploy-Secret');
    const DEPLOY_SECRET = process.env.DEPLOY_SECRET;
    if (DEPLOY_SECRET && secret && secret === DEPLOY_SECRET) {
      orgId = req.headers.get('X-Org-Id');
    }
  }

  if (!orgId) {
    return null;
  }

  // Validate UUID format before querying (prevents postgres cast errors)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    return null;
  }

  // Verify the org exists
  const result = await sql`
    SELECT id FROM organizations WHERE id = ${orgId} LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  // Return admin context with full management permissions
  return {
    orgId,
    keyId: 'internal-admin',
    scopes: ['manage:projects', 'manage:keys', 'read:usage', 'manage:instances', 'manage:apps'],
  };
}
