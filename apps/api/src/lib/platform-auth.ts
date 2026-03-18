/**
 * Platform Key Authentication for Connect Apps
 *
 * Platform keys (pk_*) are org-scoped keys auto-generated on first deploy.
 * They allow Connect apps to call platform services (email, etc.)
 * without needing a project-level API key.
 */

import crypto from 'crypto';
import { sql } from './db';
import type { AdminContext } from './admin-auth';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Cache verified platform keys for 5 minutes
const platformKeyCache = new Map<string, { orgId: string; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Generate a new platform key: pk_ + 32 hex chars
 */
function generatePlatformKey(): string {
  return 'pk_' + crypto.randomBytes(16).toString('hex');
}

/**
 * Validate a platform key from a request and return AdminContext.
 * Accepts Authorization: Bearer pk_*
 */
export async function validatePlatformKey(req: Request): Promise<AdminContext | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer pk_')) {
    return null;
  }

  const key = authHeader.slice(7); // Remove "Bearer "
  const prefix = key.substring(0, 11); // "pk_" + first 8 hex chars

  // Check cache first
  const cached = platformKeyCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return {
      orgId: cached.orgId,
      keyId: 'platform',
      scopes: ['email', 'storage', 'images', 'voice', 'feature-toggles', 'tickets'],
    };
  }

  if (!ENCRYPTION_KEY) {
    console.error('[platform-auth] ENCRYPTION_KEY not set');
    return null;
  }

  // Look up org by platform key prefix
  const rows = await sql`
    SELECT id, pgp_sym_decrypt(platform_key_encrypted, ${ENCRYPTION_KEY}) as platform_key
    FROM organizations
    WHERE platform_key_prefix = ${prefix}
      AND platform_key_encrypted IS NOT NULL
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const org = rows[0];

  // Constant-time comparison
  const storedKey = org.platform_key as string;
  if (storedKey.length !== key.length) {
    return null;
  }

  const equal = crypto.timingSafeEqual(
    Buffer.from(storedKey, 'utf-8'),
    Buffer.from(key, 'utf-8')
  );

  if (!equal) {
    return null;
  }

  // Cache the verified key
  platformKeyCache.set(key, { orgId: org.id, cachedAt: Date.now() });

  return {
    orgId: org.id,
    keyId: 'platform',
    scopes: ['email', 'storage', 'images', 'voice', 'feature-toggles', 'tickets'],
  };
}

/**
 * Ensure an org has a platform key. Generate one if missing.
 * Returns the plaintext key for deploy-time injection.
 */
export async function ensurePlatformKey(orgId: string): Promise<string | null> {
  if (!ENCRYPTION_KEY) {
    console.error('[platform-auth] ENCRYPTION_KEY not set, cannot manage platform keys');
    return null;
  }

  // Check if org already has a platform key
  const existing = await sql`
    SELECT pgp_sym_decrypt(platform_key_encrypted, ${ENCRYPTION_KEY}) as platform_key
    FROM organizations
    WHERE id = ${orgId}
      AND platform_key_encrypted IS NOT NULL
  `;

  if (existing.length > 0 && existing[0].platform_key) {
    return existing[0].platform_key as string;
  }

  // Generate new key
  const key = generatePlatformKey();
  const prefix = key.substring(0, 11);

  await sql`
    UPDATE organizations
    SET platform_key_encrypted = pgp_sym_encrypt(${key}, ${ENCRYPTION_KEY}),
        platform_key_prefix = ${prefix}
    WHERE id = ${orgId}
  `;

  console.log(`[platform-auth] Generated platform key for org ${orgId} (prefix: ${prefix})`);
  return key;
}
