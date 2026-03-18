/**
 * Organization Secrets Service
 *
 * Manages encrypted secrets stored per organization.
 * Used for storing API keys (Anthropic, OpenAI, etc.) that the proxy can use.
 */

import { sql } from '../lib/db';
import { requireEnv } from '../lib/require-env';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

/**
 * Get a decrypted secret for an organization
 * Falls back to environment variable if not found in database
 */
export async function getOrgSecret(orgId: string, name: string): Promise<string | null> {
  try {
    // Try database first
    const result = await sql`
      SELECT pgp_sym_decrypt(value_encrypted, ${ENCRYPTION_KEY}) as value
      FROM org_secrets
      WHERE org_id = ${orgId} AND name = ${name}
    `;

    if (result.length > 0 && result[0].value) {
      return result[0].value;
    }
  } catch (error) {
    // Table might not exist yet, fall through to env var fallback
    console.debug('[secrets] Database lookup failed, falling back to env var:', name);
  }

  // Fallback to environment variable
  return process.env[name] || null;
}

/**
 * Set/update a secret for an organization
 */
export async function setOrgSecret(
  orgId: string,
  name: string,
  value: string,
  options?: {
    description?: string;
    createdBy?: string;
  }
): Promise<string> {
  const result = await sql`
    INSERT INTO org_secrets (org_id, name, value_encrypted, description, created_by)
    VALUES (
      ${orgId},
      ${name},
      pgp_sym_encrypt(${value}, ${ENCRYPTION_KEY}),
      ${options?.description || null},
      ${options?.createdBy || null}
    )
    ON CONFLICT (org_id, name) DO UPDATE SET
      value_encrypted = pgp_sym_encrypt(${value}, ${ENCRYPTION_KEY}),
      description = COALESCE(EXCLUDED.description, org_secrets.description),
      updated_at = NOW()
    RETURNING id
  `;

  return result[0].id;
}

/**
 * Delete a secret for an organization
 */
export async function deleteOrgSecret(orgId: string, name: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM org_secrets
    WHERE org_id = ${orgId} AND name = ${name}
    RETURNING id
  `;

  return result.length > 0;
}

/**
 * List all secrets for an organization (names only, not values)
 */
export async function listOrgSecrets(orgId: string): Promise<Array<{
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}>> {
  const result = await sql`
    SELECT id, name, description, created_at, updated_at
    FROM org_secrets
    WHERE org_id = ${orgId}
    ORDER BY name
  `;

  return result.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Check if a secret exists for an organization
 */
export async function hasOrgSecret(orgId: string, name: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 1 FROM org_secrets
      WHERE org_id = ${orgId} AND name = ${name}
      LIMIT 1
    `;
    return result.length > 0;
  } catch {
    return false;
  }
}
