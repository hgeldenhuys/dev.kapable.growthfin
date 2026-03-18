/**
 * Management API - API Keys Endpoints
 *
 * POST   /v1/projects/:projectId/keys           - Create API key
 * GET    /v1/projects/:projectId/keys           - List API keys
 * DELETE /v1/projects/:projectId/keys/:keyId    - Revoke API key
 * POST   /v1/projects/:projectId/keys/:keyId/rotate - Rotate API key
 */

import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { sql } from '../../lib/db';
import type { AdminContext } from '../../lib/admin-auth';

interface CreateKeyBody {
  name: string;
  scopes?: string[];
  expires_at?: string;
}

/**
 * List all API keys for a project
 */
export async function listKeys(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId } = params;

  // Verify project belongs to org
  const project = await sql`
    SELECT id FROM projects
    WHERE id = ${projectId} AND org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const keys = await sql`
    SELECT
      id,
      name,
      key_prefix,
      scopes,
      last_used_at,
      expires_at,
      created_at,
      revoked_at
    FROM api_keys
    WHERE project_id = ${projectId}
      AND key_type = 'project'
    ORDER BY created_at DESC
  `;

  // Map to safe response (don't expose key_hash)
  const safeKeys = keys.map(key => ({
    id: key.id,
    name: key.name,
    key_preview: `${key.key_prefix}${'*'.repeat(20)}`,
    scopes: key.scopes,
    last_used_at: key.last_used_at,
    expires_at: key.expires_at,
    created_at: key.created_at,
    revoked_at: key.revoked_at,
    status: key.revoked_at ? 'revoked' : (key.expires_at && new Date(key.expires_at) < new Date() ? 'expired' : 'active'),
  }));

  return Response.json({
    data: safeKeys,
    total: safeKeys.length,
  });
}

/**
 * Create a new API key for a project
 */
export async function createKey(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId } = params;

  // Verify project belongs to org
  const project = await sql`
    SELECT id FROM projects
    WHERE id = ${projectId} AND org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: CreateKeyBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  // Validate scopes
  const validScopes = ['read', 'write', 'realtime'];
  const scopes = body.scopes || ['read', 'write', 'realtime'];
  for (const scope of scopes) {
    if (!validScopes.includes(scope)) {
      return Response.json({
        error: `Invalid scope: ${scope}. Valid scopes: ${validScopes.join(', ')}`,
      }, { status: 400 });
    }
  }

  // Validate expires_at if provided
  let expiresAt: Date | null = null;
  if (body.expires_at) {
    expiresAt = new Date(body.expires_at);
    if (isNaN(expiresAt.getTime())) {
      return Response.json({ error: 'Invalid expires_at date format' }, { status: 400 });
    }
    if (expiresAt < new Date()) {
      return Response.json({ error: 'expires_at must be in the future' }, { status: 400 });
    }
  }

  // Generate the key
  const apiKey = `sk_live_${nanoid(32)}`;
  const keyPrefix = apiKey.substring(0, 12);
  const keyHash = await bcrypt.hash(apiKey, 10);

  // Insert the key
  const result = await sql`
    INSERT INTO api_keys (org_id, project_id, name, key_prefix, key_hash, key_type, scopes, expires_at)
    VALUES (${ctx.orgId}, ${projectId}, ${body.name}, ${keyPrefix}, ${keyHash}, 'project', ${scopes}, ${expiresAt})
    RETURNING id, name, key_prefix, scopes, expires_at, created_at
  `;

  // Return the key (only time it's shown in full)
  return Response.json({
    ...result[0],
    key: apiKey,
    key_preview: `${keyPrefix}${'*'.repeat(20)}`,
    warning: 'Save this key - it will not be shown again!',
  }, { status: 201 });
}

/**
 * Revoke an API key
 */
export async function revokeKey(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId, keyId } = params;

  // Verify project belongs to org
  const project = await sql`
    SELECT id FROM projects
    WHERE id = ${projectId} AND org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check if key exists and belongs to project
  const existing = await sql`
    SELECT id, name, revoked_at FROM api_keys
    WHERE id = ${keyId} AND project_id = ${projectId}
    LIMIT 1
  `;

  if (existing.length === 0) {
    return Response.json({ error: 'API key not found' }, { status: 404 });
  }

  if (existing[0].revoked_at) {
    return Response.json({ error: 'API key is already revoked' }, { status: 400 });
  }

  // Revoke the key
  await sql`
    UPDATE api_keys
    SET revoked_at = NOW()
    WHERE id = ${keyId}
  `;

  return Response.json({
    revoked: true,
    key: {
      id: keyId,
      name: existing[0].name,
    },
  });
}

/**
 * Rotate an API key (revoke old, create new with same settings)
 */
export async function rotateKey(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId, keyId } = params;

  // Verify project belongs to org
  const project = await sql`
    SELECT id FROM projects
    WHERE id = ${projectId} AND org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get the existing key
  const existing = await sql`
    SELECT id, name, scopes, expires_at, revoked_at FROM api_keys
    WHERE id = ${keyId} AND project_id = ${projectId}
    LIMIT 1
  `;

  if (existing.length === 0) {
    return Response.json({ error: 'API key not found' }, { status: 404 });
  }

  if (existing[0].revoked_at) {
    return Response.json({ error: 'Cannot rotate a revoked key' }, { status: 400 });
  }

  const oldKey = existing[0];

  // Generate new key
  const apiKey = `sk_live_${nanoid(32)}`;
  const keyPrefix = apiKey.substring(0, 12);
  const keyHash = await bcrypt.hash(apiKey, 10);

  // Transaction: revoke old key and create new one
  await sql`UPDATE api_keys SET revoked_at = NOW() WHERE id = ${keyId}`;

  const result = await sql`
    INSERT INTO api_keys (org_id, project_id, name, key_prefix, key_hash, key_type, scopes, expires_at)
    VALUES (${ctx.orgId}, ${projectId}, ${oldKey.name}, ${keyPrefix}, ${keyHash}, 'project', ${oldKey.scopes}, ${oldKey.expires_at})
    RETURNING id, name, key_prefix, scopes, expires_at, created_at
  `;

  return Response.json({
    rotated: true,
    old_key_id: keyId,
    new_key: {
      ...result[0],
      key: apiKey,
      key_preview: `${keyPrefix}${'*'.repeat(20)}`,
      warning: 'Save this key - it will not be shown again!',
    },
  }, { status: 201 });
}
