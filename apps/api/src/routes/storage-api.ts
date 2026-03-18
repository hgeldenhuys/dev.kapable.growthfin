/**
 * Storage API - S3-Compatible Object Storage for Connect Apps
 *
 * All endpoints require admin auth (sk_admin_* or internal admin request).
 * Org-scoped via ctx.orgId.
 *
 * Endpoints:
 *   GET    /v1/storage/buckets           - List org buckets
 *   POST   /v1/storage/buckets           - Create bucket
 *   GET    /v1/storage/buckets/:name     - Bucket details + usage
 *   DELETE /v1/storage/buckets/:name     - Delete bucket
 *   GET    /v1/storage/usage             - Org storage usage vs quota
 *   POST   /v1/storage/presign/upload    - Presigned PUT URL
 *   POST   /v1/storage/presign/download  - Presigned GET URL
 *   GET    /v1/storage/credentials       - Show org S3 credentials
 *   POST   /v1/storage/credentials/rotate - Rotate credentials
 */

import { sql } from '../lib/db';
import type { AdminContext } from '../lib/admin-auth';
import {
  ensureOrgStorage,
  createBucket,
  deleteBucket,
  listBuckets,
  getBucketUsage,
  presignedPutUrl,
  presignedGetUrl,
  getOrgCredentials,
  rotateOrgCredentials,
  getOrgTotalUsage,
} from '../services/minio-manager';

/**
 * Resolve orgSlug from orgId (needed for bucket naming).
 */
async function getOrgSlug(orgId: string): Promise<string | null> {
  const rows = await sql`SELECT slug FROM organizations WHERE id = ${orgId}`;
  return rows.length > 0 ? rows[0].slug : null;
}

export async function handleStorageRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {
  const orgSlug = await getOrgSlug(ctx.orgId);
  if (!orgSlug) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  // GET /v1/storage/buckets
  if (pathname === '/v1/storage/buckets' && req.method === 'GET') {
    try {
      const buckets = await listBuckets(ctx.orgId);
      return Response.json({ buckets });
    } catch (err) {
      return Response.json({ error: 'Failed to list buckets', details: String(err) }, { status: 500 });
    }
  }

  // POST /v1/storage/buckets
  if (pathname === '/v1/storage/buckets' && req.method === 'POST') {
    try {
      const body = await req.json() as { name?: string; visibility?: string };
      if (!body.name) {
        return Response.json({ error: 'name is required' }, { status: 400 });
      }

      const result = await createBucket(ctx.orgId, orgSlug, body.name, body.visibility);
      return Response.json(result, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('already exists') ? 409 : 500;
      return Response.json({ error: message }, { status });
    }
  }

  // GET /v1/storage/buckets/:name
  const bucketMatch = pathname.match(/^\/v1\/storage\/buckets\/([a-z0-9-]+)$/);
  if (bucketMatch && req.method === 'GET') {
    try {
      const name = bucketMatch[1];
      const usage = await getBucketUsage(orgSlug, name);
      const rows = await sql`
        SELECT name, bucket_name, visibility, cors_origins, created_at
        FROM org_storage_buckets
        WHERE organization_id = ${ctx.orgId} AND name = ${name}
      `;
      if (rows.length === 0) {
        return Response.json({ error: 'Bucket not found' }, { status: 404 });
      }
      return Response.json({
        ...rows[0],
        sizeBytes: usage.sizeBytes,
        objectCount: usage.objectCount,
      });
    } catch (err) {
      return Response.json({ error: 'Failed to get bucket details', details: String(err) }, { status: 500 });
    }
  }

  // DELETE /v1/storage/buckets/:name
  if (bucketMatch && req.method === 'DELETE') {
    try {
      const name = bucketMatch[1];
      await deleteBucket(ctx.orgId, orgSlug, name);
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: 'Failed to delete bucket', details: String(err) }, { status: 500 });
    }
  }

  // GET /v1/storage/usage
  if (pathname === '/v1/storage/usage' && req.method === 'GET') {
    try {
      const usage = await getOrgTotalUsage(ctx.orgId);
      return Response.json(usage);
    } catch (err) {
      return Response.json({ error: 'Failed to get usage', details: String(err) }, { status: 500 });
    }
  }

  // POST /v1/storage/presign/upload
  if (pathname === '/v1/storage/presign/upload' && req.method === 'POST') {
    try {
      const body = await req.json() as { bucket?: string; key?: string; expiry?: number };
      if (!body.bucket || !body.key) {
        return Response.json({ error: 'bucket and key are required' }, { status: 400 });
      }

      // Quota check
      const usage = await getOrgTotalUsage(ctx.orgId);
      if (usage.usedBytes >= usage.quotaBytes) {
        return Response.json({
          error: 'Storage quota exceeded',
          usedBytes: usage.usedBytes,
          quotaBytes: usage.quotaBytes,
        }, { status: 402 });
      }

      // Ensure storage is provisioned
      await ensureOrgStorage(ctx.orgId, orgSlug);

      const url = await presignedPutUrl(orgSlug, body.bucket, body.key, body.expiry || 3600);
      return Response.json({ url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Access denied')) {
        return Response.json({ error: message }, { status: 403 });
      }
      return Response.json({ error: 'Failed to generate presigned URL', details: message }, { status: 500 });
    }
  }

  // POST /v1/storage/presign/download
  if (pathname === '/v1/storage/presign/download' && req.method === 'POST') {
    try {
      const body = await req.json() as { bucket?: string; key?: string; expiry?: number };
      if (!body.bucket || !body.key) {
        return Response.json({ error: 'bucket and key are required' }, { status: 400 });
      }

      const url = await presignedGetUrl(orgSlug, body.bucket, body.key, body.expiry || 3600);
      return Response.json({ url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Access denied')) {
        return Response.json({ error: message }, { status: 403 });
      }
      return Response.json({ error: 'Failed to generate presigned URL', details: message }, { status: 500 });
    }
  }

  // GET /v1/storage/credentials
  if (pathname === '/v1/storage/credentials' && req.method === 'GET') {
    try {
      // Ensure provisioned
      await ensureOrgStorage(ctx.orgId, orgSlug);
      const creds = await getOrgCredentials(ctx.orgId);
      if (!creds) {
        return Response.json({ error: 'No storage credentials found' }, { status: 404 });
      }
      return Response.json({
        accessKey: creds.accessKey,
        secretKey: creds.secretKey,
        endpoint: process.env.MINIO_EXTERNAL_ENDPOINT || 'https://s3.signaldb.live',
        region: 'us-east-1',
      });
    } catch (err) {
      return Response.json({ error: 'Failed to get credentials', details: String(err) }, { status: 500 });
    }
  }

  // POST /v1/storage/credentials/rotate
  if (pathname === '/v1/storage/credentials/rotate' && req.method === 'POST') {
    try {
      const newCreds = await rotateOrgCredentials(ctx.orgId, orgSlug);
      return Response.json({
        accessKey: newCreds.accessKey,
        secretKey: newCreds.secretKey,
        message: 'Credentials rotated successfully. Update your apps to use the new credentials.',
      });
    } catch (err) {
      return Response.json({ error: 'Failed to rotate credentials', details: String(err) }, { status: 500 });
    }
  }

  return null;
}
