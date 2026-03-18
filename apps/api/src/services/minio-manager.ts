/**
 * MinIO Manager Service
 *
 * Hybrid approach:
 * - MinIO JS SDK for data operations (presigned URLs, bucket listing)
 * - Deploy agent endpoints for admin operations (user/policy management via `mc` CLI)
 *
 * Per-org IAM isolation: each org gets a MinIO user scoped to `arn:aws:s3:::sdb-{orgSlug}-*`
 */

import { Client as MinioClient } from 'minio';
import { sql } from '../lib/db';
import { requireEnv } from '../lib/require-env';
import { nanoid } from 'nanoid';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');
const DEPLOY_AGENT_URL = process.env.DEPLOY_AGENT_URL || 'http://127.0.0.1:4100';
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || '';

// MinIO connection config — uses internal IP for server-side operations
const MINIO_INTERNAL_ENDPOINT = process.env.MINIO_INTERNAL_ENDPOINT || '10.34.154.100';
const MINIO_INTERNAL_PORT = parseInt(process.env.MINIO_INTERNAL_PORT || '9000');
const MINIO_EXTERNAL_ENDPOINT = process.env.MINIO_EXTERNAL_ENDPOINT || 'https://s3.signaldb.live';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || '';
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || '';
const MINIO_REGION = 'us-east-1';

// Lazy-init root client (for admin operations like listing buckets, presign)
let _rootClient: MinioClient | null = null;
function getRootClient(): MinioClient {
  if (!_rootClient) {
    _rootClient = new MinioClient({
      endPoint: MINIO_INTERNAL_ENDPOINT,
      port: MINIO_INTERNAL_PORT,
      useSSL: false,
      accessKey: MINIO_ROOT_USER,
      secretKey: MINIO_ROOT_PASSWORD,
      region: MINIO_REGION,
    });
  }
  return _rootClient;
}

// ─── Deploy Agent Delegation ─────────────────────────────────────────────────

async function callDeployAgent(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${DEPLOY_AGENT_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deploy-Secret': DEPLOY_SECRET,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: (data as Record<string, string>).error || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Org Storage Provisioning ────────────────────────────────────────────────

/**
 * Ensure an org has MinIO storage provisioned (lazy-init on first use).
 * Creates MinIO user, policy, and default bucket if not already set up.
 */
export async function ensureOrgStorage(orgId: string, orgSlug: string): Promise<{
  accessKey: string;
  defaultBucket: string;
}> {
  // Check if credentials already exist
  const existing = await sql`
    SELECT access_key FROM org_storage_credentials
    WHERE organization_id = ${orgId} AND status = 'active'
  `;
  if (existing.length > 0) {
    // Check default bucket exists too
    const defaultBucket = await sql`
      SELECT bucket_name FROM org_storage_buckets
      WHERE organization_id = ${orgId}
      ORDER BY created_at ASC LIMIT 1
    `;
    return {
      accessKey: existing[0].access_key,
      defaultBucket: defaultBucket.length > 0 ? defaultBucket[0].bucket_name : `sdb-${orgSlug}-default`,
    };
  }

  // Generate credentials
  const accessKey = `sdb_${orgSlug}_${nanoid(12)}`;
  const secretKey = nanoid(32);
  const policyName = `sdb-policy-${orgSlug}`;

  // Create MinIO user + policy via deploy agent
  const result = await callDeployAgent('/minio/create-org-account', {
    orgSlug,
    accessKey,
    secretKey,
    policyName,
  });

  if (!result.ok) {
    throw new Error(`Failed to create MinIO org account: ${result.error}`);
  }

  // Store credentials in DB (secret key encrypted)
  await sql`
    INSERT INTO org_storage_credentials (organization_id, access_key, secret_key_encrypted, policy_name)
    VALUES (
      ${orgId},
      ${accessKey},
      encode(pgp_sym_encrypt(${secretKey}, ${ENCRYPTION_KEY}), 'hex'),
      ${policyName}
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      access_key = EXCLUDED.access_key,
      secret_key_encrypted = EXCLUDED.secret_key_encrypted,
      policy_name = EXCLUDED.policy_name,
      status = 'active',
      updated_at = now()
  `;

  // Create default bucket
  const defaultBucketName = `sdb-${orgSlug}-default`;
  await createBucketInternal(orgId, orgSlug, 'default', defaultBucketName);

  return { accessKey, defaultBucket: defaultBucketName };
}

// ─── Bucket Operations ───────────────────────────────────────────────────────

async function createBucketInternal(orgId: string, orgSlug: string, name: string, bucketName: string): Promise<void> {
  const client = getRootClient();

  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName, MINIO_REGION);
  }

  await sql`
    INSERT INTO org_storage_buckets (organization_id, name, bucket_name)
    VALUES (${orgId}, ${name}, ${bucketName})
    ON CONFLICT (organization_id, name) DO NOTHING
  `;
}

export async function createBucket(orgId: string, orgSlug: string, name: string, visibility?: string): Promise<{ bucketName: string }> {
  // Validate name (lowercase, alphanumeric + hyphens)
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(name)) {
    throw new Error('Bucket name must be 3-32 chars, lowercase alphanumeric and hyphens, start/end with alphanumeric');
  }

  const bucketName = `sdb-${orgSlug}-${name}`;

  // Ensure org storage is provisioned first
  await ensureOrgStorage(orgId, orgSlug);

  const client = getRootClient();
  const exists = await client.bucketExists(bucketName);
  if (exists) {
    throw new Error(`Bucket "${name}" already exists`);
  }

  await client.makeBucket(bucketName, MINIO_REGION);

  // Set public-read policy if requested
  if (visibility === 'public') {
    const publicPolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      }],
    });
    await client.setBucketPolicy(bucketName, publicPolicy);
  }

  await sql`
    INSERT INTO org_storage_buckets (organization_id, name, bucket_name, visibility)
    VALUES (${orgId}, ${name}, ${bucketName}, ${visibility || 'private'})
  `;

  return { bucketName };
}

export async function deleteBucket(orgId: string, orgSlug: string, name: string): Promise<void> {
  const bucketName = `sdb-${orgSlug}-${name}`;
  const client = getRootClient();

  const exists = await client.bucketExists(bucketName);
  if (exists) {
    // Remove all objects first
    const objects = await new Promise<string[]>((resolve) => {
      const items: string[] = [];
      const stream = client.listObjects(bucketName, '', true);
      stream.on('data', (obj) => { if (obj.name) items.push(obj.name); });
      stream.on('end', () => resolve(items));
      stream.on('error', () => resolve(items));
    });

    if (objects.length > 0) {
      await client.removeObjects(bucketName, objects);
    }
    await client.removeBucket(bucketName);
  }

  await sql`
    DELETE FROM org_storage_buckets
    WHERE organization_id = ${orgId} AND name = ${name}
  `;
}

export async function listBuckets(orgId: string): Promise<Array<{
  name: string;
  bucketName: string;
  sizeBytes: number;
  objectCount: number;
  visibility: string;
  createdAt: string;
}>> {
  const rows = await sql`
    SELECT name, bucket_name, size_bytes, object_count, visibility, created_at
    FROM org_storage_buckets
    WHERE organization_id = ${orgId}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => ({
    name: r.name,
    bucketName: r.bucket_name,
    sizeBytes: Number(r.size_bytes),
    objectCount: Number(r.object_count),
    visibility: r.visibility,
    createdAt: r.created_at,
  }));
}

export async function getBucketUsage(orgSlug: string, name: string): Promise<{ sizeBytes: number; objectCount: number }> {
  const bucketName = `sdb-${orgSlug}-${name}`;
  const client = getRootClient();

  let sizeBytes = 0;
  let objectCount = 0;

  const stream = client.listObjects(bucketName, '', true);
  for await (const obj of stream) {
    sizeBytes += obj.size || 0;
    objectCount++;
  }

  return { sizeBytes, objectCount };
}

// ─── Presigned URLs ──────────────────────────────────────────────────────────

export async function presignedPutUrl(orgSlug: string, bucketName: string, key: string, expiry: number = 3600): Promise<string> {
  // Verify bucket belongs to org
  if (!bucketName.startsWith(`sdb-${orgSlug}-`)) {
    throw new Error('Access denied: bucket does not belong to this organization');
  }
  const client = getRootClient();
  return await client.presignedPutObject(bucketName, key, expiry);
}

export async function presignedGetUrl(orgSlug: string, bucketName: string, key: string, expiry: number = 3600): Promise<string> {
  if (!bucketName.startsWith(`sdb-${orgSlug}-`)) {
    throw new Error('Access denied: bucket does not belong to this organization');
  }
  const client = getRootClient();
  return await client.presignedGetObject(bucketName, key, expiry);
}

// ─── Credentials ─────────────────────────────────────────────────────────────

export async function getOrgCredentials(orgId: string): Promise<{
  accessKey: string;
  secretKey: string;
} | null> {
  const rows = await sql`
    SELECT access_key, pgp_sym_decrypt(decode(secret_key_encrypted, 'hex'), ${ENCRYPTION_KEY}) as secret_key
    FROM org_storage_credentials
    WHERE organization_id = ${orgId} AND status = 'active'
  `;
  if (rows.length === 0) return null;
  return { accessKey: rows[0].access_key, secretKey: rows[0].secret_key };
}

export async function rotateOrgCredentials(orgId: string, orgSlug: string): Promise<{
  accessKey: string;
  secretKey: string;
}> {
  // Generate new credentials
  const newAccessKey = `sdb_${orgSlug}_${nanoid(12)}`;
  const newSecretKey = nanoid(32);
  const policyName = `sdb-policy-${orgSlug}`;

  // Delete old account and create new via deploy agent
  await callDeployAgent('/minio/delete-org-account', { orgSlug });
  const result = await callDeployAgent('/minio/create-org-account', {
    orgSlug,
    accessKey: newAccessKey,
    secretKey: newSecretKey,
    policyName,
  });

  if (!result.ok) {
    throw new Error(`Failed to rotate MinIO credentials: ${result.error}`);
  }

  // Update DB
  await sql`
    UPDATE org_storage_credentials SET
      access_key = ${newAccessKey},
      secret_key_encrypted = encode(pgp_sym_encrypt(${newSecretKey}, ${ENCRYPTION_KEY}), 'hex'),
      status = 'active',
      updated_at = now()
    WHERE organization_id = ${orgId}
  `;

  return { accessKey: newAccessKey, secretKey: newSecretKey };
}

// ─── Usage ───────────────────────────────────────────────────────────────────

export async function getOrgTotalUsage(orgId: string): Promise<{
  usedBytes: number;
  quotaBytes: number;
  bucketCount: number;
}> {
  const rows = await sql`
    SELECT
      o.storage_used_bytes,
      o.storage_quota_bytes,
      (SELECT COUNT(*) FROM org_storage_buckets WHERE organization_id = ${orgId}) as bucket_count
    FROM organizations o
    WHERE o.id = ${orgId}
  `;
  if (rows.length === 0) return { usedBytes: 0, quotaBytes: 1073741824, bucketCount: 0 };
  return {
    usedBytes: Number(rows[0].storage_used_bytes),
    quotaBytes: Number(rows[0].storage_quota_bytes),
    bucketCount: Number(rows[0].bucket_count),
  };
}

/**
 * Sync MinIO usage stats into the database.
 * Called by the background usage sync job.
 */
export async function syncStorageUsage(): Promise<void> {
  const client = getRootClient();

  // Get all org buckets
  const buckets = await sql`
    SELECT id, organization_id, bucket_name FROM org_storage_buckets
  `;

  for (const bucket of buckets) {
    try {
      let sizeBytes = 0;
      let objectCount = 0;

      const stream = client.listObjects(bucket.bucket_name, '', true);
      for await (const obj of stream) {
        sizeBytes += obj.size || 0;
        objectCount++;
      }

      await sql`
        UPDATE org_storage_buckets SET
          size_bytes = ${sizeBytes},
          object_count = ${objectCount},
          updated_at = now()
        WHERE id = ${bucket.id}
      `;
    } catch (err) {
      console.error(`[minio-manager] Failed to sync usage for bucket ${bucket.bucket_name}:`, err);
    }
  }

  // Update org-level totals
  await sql`
    UPDATE organizations SET storage_used_bytes = COALESCE(
      (SELECT SUM(size_bytes) FROM org_storage_buckets WHERE organization_id = organizations.id),
      0
    )
    WHERE id IN (SELECT DISTINCT organization_id FROM org_storage_buckets)
  `;
}

/**
 * Resolve S3 credentials for deploy-time env var injection.
 * Returns env vars to inject, or empty object if org has no storage.
 */
export async function resolveStorageCredentials(orgId: string): Promise<Record<string, string>> {
  const creds = await getOrgCredentials(orgId);
  if (!creds) return {};

  const defaultBucket = await sql`
    SELECT bucket_name FROM org_storage_buckets
    WHERE organization_id = ${orgId}
    ORDER BY created_at ASC LIMIT 1
  `;

  return {
    S3_ENDPOINT: MINIO_EXTERNAL_ENDPOINT,
    S3_INTERNAL_ENDPOINT: `http://${MINIO_INTERNAL_ENDPOINT}:${MINIO_INTERNAL_PORT}`,
    S3_ACCESS_KEY: creds.accessKey,
    S3_SECRET_KEY: creds.secretKey,
    S3_BUCKET: defaultBucket.length > 0 ? defaultBucket[0].bucket_name : '',
    S3_REGION: MINIO_REGION,
  };
}

// ─── Tier Quotas ─────────────────────────────────────────────────────────────

const TIER_QUOTAS: Record<string, number> = {
  hobbyist: 1 * 1024 * 1024 * 1024,       // 1 GB
  pro: 5 * 1024 * 1024 * 1024,             // 5 GB
  business: 20 * 1024 * 1024 * 1024,       // 20 GB
  enterprise: 100 * 1024 * 1024 * 1024,    // 100 GB
};

export function getQuotaForTier(tier: string): number {
  return TIER_QUOTAS[tier] || TIER_QUOTAS.hobbyist;
}

// ─── Background Usage Sync ───────────────────────────────────────────────────

const STORAGE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Start periodic storage usage sync.
 * Runs every 5 minutes to update bucket sizes and org totals.
 */
export function startStorageUsageSync(): void {
  // Don't start if MinIO isn't configured
  if (!MINIO_ROOT_USER || !MINIO_ROOT_PASSWORD) {
    console.log('[storage-sync] MinIO not configured, skipping usage sync');
    return;
  }

  console.log('[storage-sync] Starting storage usage sync (every 5 min)');

  const run = async () => {
    try {
      await syncStorageUsage();
      console.debug('[storage-sync] Usage sync completed');
    } catch (err) {
      console.error('[storage-sync] Usage sync failed:', err);
    }
  };

  // Initial sync after 30s delay (let server start up first)
  setTimeout(run, 30_000);
  // Then every 5 minutes
  setInterval(run, STORAGE_SYNC_INTERVAL);
}
