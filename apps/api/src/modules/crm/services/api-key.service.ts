/**
 * API Key Service (Phase T)
 * Self-service API key management with SHA-256 hashing.
 * Keys are generated with a recognizable prefix and stored as hashes.
 * The plaintext key is only returned once at creation time.
 */

import crypto from 'crypto';
import type { Database } from '@agios/db';
import { crmApiKeys } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';
import type { CrmApiKey } from '@agios/db/schema';

// ============================================================================
// Constants
// ============================================================================

const KEY_PREFIX = 'agios_ak_';

// ============================================================================
// Types
// ============================================================================

export interface CreateKeyInput {
  workspaceId: string;
  name: string;
  permissions?: string[];
  expiresAt?: Date;
  createdBy?: string;
}

export interface KeyValidationResult {
  valid: boolean;
  workspaceId?: string;
  permissions?: string[];
  keyId?: string;
}

// Sanitized key info (never includes the hash)
export interface ApiKeyInfo {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Service
// ============================================================================

export class ApiKeyService {
  /**
   * Generate a new API key.
   * Returns the plaintext key (shown only once) and the key record.
   */
  async createKey(
    db: Database,
    data: CreateKeyInput
  ): Promise<{ key: string; keyRecord: ApiKeyInfo }> {
    // Generate random key: prefix + 32 random hex chars
    const randomPart = crypto.randomBytes(32).toString('hex');
    const key = `${KEY_PREFIX}${randomPart}`;

    // Hash the key for storage
    const keyHash = this.hashKey(key);

    // Extract prefix for identification (the readable prefix portion)
    const keyPrefix = key.substring(0, KEY_PREFIX.length + 8); // e.g., 'agios_ak_a1b2c3d4'

    const [record] = await db
      .insert(crmApiKeys)
      .values({
        workspaceId: data.workspaceId,
        name: data.name,
        keyHash,
        keyPrefix,
        permissions: data.permissions || ['read'],
        expiresAt: data.expiresAt ?? null,
        createdBy: data.createdBy ?? null,
      })
      .returning();

    return {
      key, // Only returned once!
      keyRecord: this.toKeyInfo(record),
    };
  }

  /**
   * Validate an API key.
   * Hashes the provided key and looks it up by hash.
   * Checks isActive and expiresAt. Updates lastUsedAt on success.
   */
  async validateKey(
    db: Database,
    key: string
  ): Promise<KeyValidationResult> {
    const keyHash = this.hashKey(key);

    const [record] = await db
      .select()
      .from(crmApiKeys)
      .where(eq(crmApiKeys.keyHash, keyHash));

    if (!record) {
      return { valid: false };
    }

    // Check if active
    if (!record.isActive) {
      return { valid: false };
    }

    // Check expiration
    if (record.expiresAt && record.expiresAt < new Date()) {
      return { valid: false };
    }

    // Update lastUsedAt
    await db
      .update(crmApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(crmApiKeys.id, record.id));

    return {
      valid: true,
      workspaceId: record.workspaceId,
      permissions: record.permissions as string[],
      keyId: record.id,
    };
  }

  /**
   * List all keys for a workspace.
   * Never returns the key hash.
   */
  async listKeys(db: Database, workspaceId: string): Promise<ApiKeyInfo[]> {
    const records = await db
      .select()
      .from(crmApiKeys)
      .where(eq(crmApiKeys.workspaceId, workspaceId));

    return records.map((r: CrmApiKey) => this.toKeyInfo(r));
  }

  /**
   * Revoke (deactivate) a key.
   */
  async revokeKey(
    db: Database,
    keyId: string,
    workspaceId: string
  ): Promise<void> {
    const result = await db
      .update(crmApiKeys)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmApiKeys.id, keyId),
          eq(crmApiKeys.workspaceId, workspaceId)
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error('API key not found');
    }
  }

  /**
   * Hash an API key using SHA-256.
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Convert a database record to a sanitized key info object (no hash).
   */
  private toKeyInfo(record: CrmApiKey): ApiKeyInfo {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      name: record.name,
      keyPrefix: record.keyPrefix,
      permissions: record.permissions as string[],
      lastUsedAt: record.lastUsedAt,
      expiresAt: record.expiresAt,
      isActive: record.isActive,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export const apiKeyService = new ApiKeyService();
