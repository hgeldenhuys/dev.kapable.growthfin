-- 053_object_storage.sql
-- MinIO S3-compatible object storage for Connect apps
-- Per-org IAM isolation with bucket-level policies

-- Add storage quota columns to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT NOT NULL DEFAULT 1073741824,  -- 1GB default
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- Per-org MinIO service account credentials
CREATE TABLE IF NOT EXISTS org_storage_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_key TEXT NOT NULL,
  secret_key_encrypted BYTEA NOT NULL,
  policy_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'rotating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- Per-org storage buckets
CREATE TABLE IF NOT EXISTS org_storage_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bucket_name TEXT NOT NULL UNIQUE,  -- sdb-{orgSlug}-{name}
  size_bytes BIGINT NOT NULL DEFAULT 0,
  object_count INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  cors_origins TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_storage_buckets_org ON org_storage_buckets(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_storage_credentials_org ON org_storage_credentials(organization_id);
