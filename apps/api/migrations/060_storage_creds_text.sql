-- Migration 060: Convert org_storage_credentials.secret_key_encrypted from BYTEA to TEXT (hex-encoded)
-- This standardizes all encrypted columns to use TEXT + decode(col, 'hex') pattern
-- instead of mixing BYTEA and TEXT across the codebase.

-- Step 1: Add new TEXT column
ALTER TABLE org_storage_credentials ADD COLUMN IF NOT EXISTS secret_key_encrypted_hex TEXT;

-- Step 2: Copy existing data, converting bytea to hex-encoded text
UPDATE org_storage_credentials
SET secret_key_encrypted_hex = encode(secret_key_encrypted, 'hex')
WHERE secret_key_encrypted IS NOT NULL AND secret_key_encrypted_hex IS NULL;

-- Step 3: Drop old bytea column and rename new one
ALTER TABLE org_storage_credentials DROP COLUMN IF EXISTS secret_key_encrypted;
ALTER TABLE org_storage_credentials RENAME COLUMN secret_key_encrypted_hex TO secret_key_encrypted;

-- Step 4: Add NOT NULL constraint
ALTER TABLE org_storage_credentials ALTER COLUMN secret_key_encrypted SET NOT NULL;
