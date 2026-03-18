/**
 * CRM Sync Service (Phase V)
 *
 * Orchestrates data sync between NewLeads CRM and external CRM systems.
 * Provides:
 * - Connection CRUD (create, read, update, delete sync connections)
 * - Field mapping CRUD
 * - Sync execution (full and delta)
 * - Duplicate detection (by email, phone, or name combination)
 * - Sync log management and statistics
 */

import type { Database } from '@agios/db';
import {
  crmSyncConnections,
  crmFieldMappings,
  crmSyncLogs,
  crmLeads,
  crmContacts,
  crmAccounts,
} from '@agios/db/schema';
import { eq, and, desc, or, ilike, sql } from 'drizzle-orm';

import type { CrmSyncAdapter, SyncRecord } from './sync-adapter';
import { SalesforceAdapter } from './salesforce-adapter';
import { HubSpotAdapter } from './hubspot-adapter';
import type {
  CrmSyncConnection,
  NewCrmSyncConnection,
  CrmFieldMapping,
  NewCrmFieldMapping,
  CrmSyncLog,
  SyncStats,
} from '@agios/db/schema';

// ============================================================================
// SYNC SERVICE
// ============================================================================

export class SyncService {
  // --------------------------------------------------------------------------
  // Adapter factory
  // --------------------------------------------------------------------------

  /**
   * Get the appropriate adapter for a sync connection.
   */
  getAdapter(connection: CrmSyncConnection): CrmSyncAdapter {
    switch (connection.provider) {
      case 'salesforce':
        if (!connection.accessToken || !connection.instanceUrl) {
          throw new Error('Salesforce connection missing accessToken or instanceUrl');
        }
        return new SalesforceAdapter(connection.accessToken, connection.instanceUrl);

      case 'hubspot':
        if (!connection.accessToken) {
          throw new Error('HubSpot connection missing accessToken');
        }
        return new HubSpotAdapter(connection.accessToken);

      default:
        throw new Error(`Unsupported CRM provider: ${connection.provider}`);
    }
  }

  // --------------------------------------------------------------------------
  // Sync execution
  // --------------------------------------------------------------------------

  /**
   * Run a sync for a given connection.
   * Creates a sync log, fetches records, maps fields, detects duplicates,
   * and creates/updates local records.
   */
  async runSync(
    db: Database,
    connectionId: string,
    workspaceId: string,
    type: 'full' | 'delta' | 'manual',
  ): Promise<CrmSyncLog> {
    // Load connection
    const [connection] = await db
      .select()
      .from(crmSyncConnections)
      .where(
        and(
          eq(crmSyncConnections.id, connectionId),
          eq(crmSyncConnections.workspaceId, workspaceId),
        )
      );

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (!connection.syncEnabled) {
      throw new Error('Sync is disabled for this connection');
    }

    // Get adapter
    const adapter = this.getAdapter(connection);

    // Load field mappings grouped by entity type
    const mappings = await db
      .select()
      .from(crmFieldMappings)
      .where(
        and(
          eq(crmFieldMappings.connectionId, connectionId),
          eq(crmFieldMappings.workspaceId, workspaceId),
        )
      );

    // Group mappings by entity type
    const mappingsByEntity = new Map<string, CrmFieldMapping[]>();
    for (const mapping of mappings) {
      const existing = mappingsByEntity.get(mapping.entityType) || [];
      existing.push(mapping);
      mappingsByEntity.set(mapping.entityType, existing);
    }

    // Determine sync direction based on connection config
    const directions: Array<'inbound' | 'outbound'> = [];
    if (connection.syncDirection === 'inbound' || connection.syncDirection === 'bidirectional') {
      directions.push('inbound');
    }
    if (connection.syncDirection === 'outbound' || connection.syncDirection === 'bidirectional') {
      directions.push('outbound');
    }

    const startedAt = new Date();
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrored = 0;
    let totalProcessed = 0;
    const allErrors: Array<{ record: string; error: string }> = [];

    // Get last delta token from the most recent successful sync log
    let lastDeltaToken: string | undefined;
    if (type === 'delta') {
      const [lastLog] = await db
        .select()
        .from(crmSyncLogs)
        .where(
          and(
            eq(crmSyncLogs.connectionId, connectionId),
            eq(crmSyncLogs.status, 'success'),
          )
        )
        .orderBy(desc(crmSyncLogs.completedAt))
        .limit(1);
      lastDeltaToken = lastLog?.deltaToken ?? undefined;
    }

    // Process each entity type with mappings
    for (const [entityType, entityMappings] of mappingsByEntity) {
      for (const direction of directions) {
        // Create sync log entry for this entity+direction
        const [syncLog] = await db
          .insert(crmSyncLogs)
          .values({
            connectionId,
            workspaceId,
            syncType: type === 'manual' ? 'manual' : type,
            direction,
            entityType,
            status: 'running',
            startedAt,
          })
          .returning();

        try {
          if (direction === 'inbound') {
            // Fetch from external CRM
            const since = type === 'delta' && connection.lastSyncAt
              ? connection.lastSyncAt.toISOString()
              : undefined;

            const fetchResult = await adapter.fetchRecords(
              entityType,
              since,
              lastDeltaToken,
            );

            for (const record of fetchResult.records) {
              totalProcessed++;
              try {
                // Apply field mappings
                const mappedData = this.applyFieldMapping(record, entityMappings, 'inbound');

                // Detect duplicates
                const existingId = await this.findDuplicate(db, workspaceId, entityType, mappedData);

                if (existingId) {
                  // Update existing record
                  await this.updateLocalRecord(db, entityType, existingId, mappedData);
                  totalUpdated++;
                } else if (!record.isDeleted) {
                  // Create new record
                  await this.createLocalRecord(db, workspaceId, entityType, mappedData);
                  totalCreated++;
                } else {
                  totalSkipped++;
                }
              } catch (err) {
                totalErrored++;
                allErrors.push({
                  record: record.externalId,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }

            // Update sync log with results
            const completedAt = new Date();
            await db
              .update(crmSyncLogs)
              .set({
                status: totalErrored > 0 ? 'partial' : 'success',
                recordsProcessed: fetchResult.records.length,
                recordsCreated: totalCreated,
                recordsUpdated: totalUpdated,
                recordsSkipped: totalSkipped,
                recordsErrored: totalErrored,
                errors: allErrors.length > 0 ? allErrors : null,
                completedAt,
                durationMs: completedAt.getTime() - startedAt.getTime(),
                deltaToken: fetchResult.nextDeltaToken ?? null,
              })
              .where(eq(crmSyncLogs.id, syncLog.id));
          } else {
            // Outbound sync: placeholder - would fetch local records changed since last sync
            // and push to external CRM
            await db
              .update(crmSyncLogs)
              .set({
                status: 'success',
                completedAt: new Date(),
                durationMs: new Date().getTime() - startedAt.getTime(),
              })
              .where(eq(crmSyncLogs.id, syncLog.id));
          }
        } catch (err) {
          const completedAt = new Date();
          await db
            .update(crmSyncLogs)
            .set({
              status: 'error',
              errors: [{ record: '*', error: err instanceof Error ? err.message : String(err) }],
              completedAt,
              durationMs: completedAt.getTime() - startedAt.getTime(),
            })
            .where(eq(crmSyncLogs.id, syncLog.id));

          totalErrored++;
          allErrors.push({
            record: '*',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Update connection sync state
    const syncStats: SyncStats = {
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrored,
    };

    await db
      .update(crmSyncConnections)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: totalErrored > 0 ? (totalCreated + totalUpdated > 0 ? 'partial' : 'error') : 'success',
        lastSyncError: allErrors.length > 0 ? allErrors[0]!.error : null,
        lastSyncStats: syncStats,
        updatedAt: new Date(),
      })
      .where(eq(crmSyncConnections.id, connectionId));

    // Return the most recent sync log
    const [latestLog] = await db
      .select()
      .from(crmSyncLogs)
      .where(eq(crmSyncLogs.connectionId, connectionId))
      .orderBy(desc(crmSyncLogs.startedAt))
      .limit(1);

    return latestLog;
  }

  // --------------------------------------------------------------------------
  // Field mapping logic
  // --------------------------------------------------------------------------

  /**
   * Apply field mappings to transform a sync record into local data format.
   */
  applyFieldMapping(
    record: SyncRecord,
    mappings: CrmFieldMapping[],
    direction: 'inbound' | 'outbound',
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
      // Skip mappings that don't match the sync direction
      if (mapping.direction !== 'bidirectional' && mapping.direction !== direction) {
        continue;
      }

      const sourceField = direction === 'inbound' ? mapping.externalField : mapping.localField;
      const targetField = direction === 'inbound' ? mapping.localField : mapping.externalField;

      // Get value from source (supports nested paths like 'properties.industry')
      let value = this.getNestedValue(record.data, sourceField);

      // Apply transform
      if (value !== undefined && value !== null) {
        value = this.applyTransform(value, mapping.transformType, mapping.transformConfig);
      }

      // Set value on target (supports nested paths)
      if (value !== undefined) {
        this.setNestedValue(result, targetField, value);
      }
    }

    return result;
  }

  /**
   * Apply a field transform to a value.
   */
  private applyTransform(
    value: unknown,
    transformType: string,
    _transformConfig: unknown,
  ): unknown {
    switch (transformType) {
      case 'none':
        return value;
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'date_format': {
        if (typeof value !== 'string') return value;
        // Basic date parsing - could be extended with config-driven formats
        try {
          return new Date(value).toISOString();
        } catch {
          return value;
        }
      }
      case 'custom': {
        // Custom transforms are defined in transformConfig
        // For now, pass through
        return value;
      }
      default:
        return value;
    }
  }

  /**
   * Get a nested value from an object using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Set a nested value on an object using dot notation.
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    const lastPart = parts[parts.length - 1];
    if (lastPart !== undefined) {
      current[lastPart] = value;
    }
  }

  // --------------------------------------------------------------------------
  // Duplicate detection
  // --------------------------------------------------------------------------

  /**
   * Find a duplicate local record by matching on email, phone, or name combination.
   * Returns the ID of the existing record if found, null otherwise.
   */
  async findDuplicate(
    db: Database,
    workspaceId: string,
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<string | null> {
    const email = data['email'] as string | undefined;
    const phone = data['phone'] as string | undefined;
    const firstName = data['firstName'] as string | undefined;
    const lastName = data['lastName'] as string | undefined;

    if (entityType === 'lead') {
      const conditions = [];

      if (email) {
        conditions.push(ilike(crmLeads.email, email));
      }
      if (phone) {
        conditions.push(eq(crmLeads.phone, phone));
      }

      if (conditions.length === 0 && firstName && lastName) {
        // Fall back to name matching
        conditions.push(
          and(
            ilike(crmLeads.firstName, firstName),
            ilike(crmLeads.lastName, lastName),
          )!,
        );
      }

      if (conditions.length === 0) return null;

      const [existing] = await db
        .select({ id: crmLeads.id })
        .from(crmLeads)
        .where(
          and(
            eq(crmLeads.workspaceId, workspaceId),
            or(...conditions),
          )
        )
        .limit(1);

      return existing?.id ?? null;
    }

    if (entityType === 'contact') {
      const conditions = [];

      if (email) {
        conditions.push(ilike(crmContacts.email, email));
      }
      if (phone) {
        conditions.push(eq(crmContacts.phone, phone));
      }

      if (conditions.length === 0 && firstName && lastName) {
        conditions.push(
          and(
            ilike(crmContacts.firstName, firstName),
            ilike(crmContacts.lastName, lastName),
          )!,
        );
      }

      if (conditions.length === 0) return null;

      const [existing] = await db
        .select({ id: crmContacts.id })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.workspaceId, workspaceId),
            or(...conditions),
          )
        )
        .limit(1);

      return existing?.id ?? null;
    }

    if (entityType === 'account') {
      const name = data['name'] as string | undefined;
      if (!name) return null;

      const [existing] = await db
        .select({ id: crmAccounts.id })
        .from(crmAccounts)
        .where(
          and(
            eq(crmAccounts.workspaceId, workspaceId),
            ilike(crmAccounts.name, name),
          )
        )
        .limit(1);

      return existing?.id ?? null;
    }

    // For opportunity and other types, no duplicate detection by default
    return null;
  }

  // --------------------------------------------------------------------------
  // Local record operations (inbound sync)
  // --------------------------------------------------------------------------

  /**
   * Create a local CRM record from sync data.
   */
  private async createLocalRecord(
    db: Database,
    workspaceId: string,
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    if (entityType === 'lead') {
      const [record] = await db
        .insert(crmLeads)
        .values({
          workspaceId,
          firstName: (data['firstName'] as string) || 'Unknown',
          lastName: (data['lastName'] as string) || 'Unknown',
          email: data['email'] as string | undefined,
          phone: data['phone'] as string | undefined,
          company: data['company'] as string | undefined,
          title: data['title'] as string | undefined,
          source: 'crm_sync',
        })
        .returning();
      return record.id;
    }

    if (entityType === 'contact') {
      const [record] = await db
        .insert(crmContacts)
        .values({
          workspaceId,
          firstName: (data['firstName'] as string) || 'Unknown',
          lastName: (data['lastName'] as string) || 'Unknown',
          email: data['email'] as string | undefined,
          phone: data['phone'] as string | undefined,
          accountId: data['accountId'] as string | undefined,
        })
        .returning();
      return record.id;
    }

    if (entityType === 'account') {
      const [record] = await db
        .insert(crmAccounts)
        .values({
          workspaceId,
          name: (data['name'] as string) || 'Unknown Account',
          industry: data['industry'] as string | undefined,
          website: data['website'] as string | undefined,
        })
        .returning();
      return record.id;
    }

    throw new Error(`Unsupported entity type for record creation: ${entityType}`);
  }

  /**
   * Update an existing local CRM record.
   */
  private async updateLocalRecord(
    db: Database,
    entityType: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

    // Remove any fields that shouldn't be overwritten
    delete updateData['id'];
    delete updateData['workspaceId'];
    delete updateData['createdAt'];

    if (entityType === 'lead') {
      await db
        .update(crmLeads)
        .set(updateData)
        .where(eq(crmLeads.id, recordId));
    } else if (entityType === 'contact') {
      await db
        .update(crmContacts)
        .set(updateData)
        .where(eq(crmContacts.id, recordId));
    } else if (entityType === 'account') {
      await db
        .update(crmAccounts)
        .set(updateData)
        .where(eq(crmAccounts.id, recordId));
    }
  }

  // --------------------------------------------------------------------------
  // Connection CRUD
  // --------------------------------------------------------------------------

  async createConnection(
    db: Database,
    data: NewCrmSyncConnection,
  ): Promise<CrmSyncConnection> {
    const [connection] = await db
      .insert(crmSyncConnections)
      .values(data)
      .returning();
    return connection;
  }

  async updateConnection(
    db: Database,
    id: string,
    workspaceId: string,
    data: Partial<Omit<NewCrmSyncConnection, 'id' | 'workspaceId' | 'createdAt'>>,
  ): Promise<CrmSyncConnection | null> {
    const [updated] = await db
      .update(crmSyncConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmSyncConnections.id, id),
          eq(crmSyncConnections.workspaceId, workspaceId),
        )
      )
      .returning();
    return updated ?? null;
  }

  async deleteConnection(
    db: Database,
    id: string,
    workspaceId: string,
  ): Promise<boolean> {
    const [deleted] = await db
      .delete(crmSyncConnections)
      .where(
        and(
          eq(crmSyncConnections.id, id),
          eq(crmSyncConnections.workspaceId, workspaceId),
        )
      )
      .returning();
    return !!deleted;
  }

  async listConnections(
    db: Database,
    workspaceId: string,
  ): Promise<CrmSyncConnection[]> {
    return db
      .select()
      .from(crmSyncConnections)
      .where(eq(crmSyncConnections.workspaceId, workspaceId))
      .orderBy(desc(crmSyncConnections.createdAt));
  }

  async getConnection(
    db: Database,
    id: string,
    workspaceId: string,
  ): Promise<CrmSyncConnection | null> {
    const [connection] = await db
      .select()
      .from(crmSyncConnections)
      .where(
        and(
          eq(crmSyncConnections.id, id),
          eq(crmSyncConnections.workspaceId, workspaceId),
        )
      );
    return connection ?? null;
  }

  // --------------------------------------------------------------------------
  // Field mapping CRUD
  // --------------------------------------------------------------------------

  async createFieldMapping(
    db: Database,
    data: NewCrmFieldMapping,
  ): Promise<CrmFieldMapping> {
    const [mapping] = await db
      .insert(crmFieldMappings)
      .values(data)
      .returning();
    return mapping;
  }

  async updateFieldMapping(
    db: Database,
    id: string,
    workspaceId: string,
    data: Partial<Omit<NewCrmFieldMapping, 'id' | 'workspaceId' | 'connectionId' | 'createdAt'>>,
  ): Promise<CrmFieldMapping | null> {
    const [updated] = await db
      .update(crmFieldMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmFieldMappings.id, id),
          eq(crmFieldMappings.workspaceId, workspaceId),
        )
      )
      .returning();
    return updated ?? null;
  }

  async deleteFieldMapping(
    db: Database,
    id: string,
    workspaceId: string,
  ): Promise<boolean> {
    const [deleted] = await db
      .delete(crmFieldMappings)
      .where(
        and(
          eq(crmFieldMappings.id, id),
          eq(crmFieldMappings.workspaceId, workspaceId),
        )
      )
      .returning();
    return !!deleted;
  }

  async listFieldMappings(
    db: Database,
    connectionId: string,
    workspaceId: string,
    entityType?: string,
  ): Promise<CrmFieldMapping[]> {
    const conditions = [
      eq(crmFieldMappings.connectionId, connectionId),
      eq(crmFieldMappings.workspaceId, workspaceId),
    ];

    if (entityType) {
      conditions.push(eq(crmFieldMappings.entityType, entityType));
    }

    return db
      .select()
      .from(crmFieldMappings)
      .where(and(...conditions))
      .orderBy(crmFieldMappings.entityType, crmFieldMappings.localField);
  }

  // --------------------------------------------------------------------------
  // Sync logs
  // --------------------------------------------------------------------------

  async listSyncLogs(
    db: Database,
    connectionId: string,
    workspaceId: string,
    limit = 50,
  ): Promise<CrmSyncLog[]> {
    return db
      .select()
      .from(crmSyncLogs)
      .where(
        and(
          eq(crmSyncLogs.connectionId, connectionId),
          eq(crmSyncLogs.workspaceId, workspaceId),
        )
      )
      .orderBy(desc(crmSyncLogs.startedAt))
      .limit(limit);
  }

  async getSyncStats(
    db: Database,
    workspaceId: string,
  ): Promise<{
    connections: number;
    lastSync: Date | null;
    totalSynced: number;
    errors: number;
  }> {
    // Count connections
    const [connResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmSyncConnections)
      .where(eq(crmSyncConnections.workspaceId, workspaceId));

    // Get latest sync
    const [latestSync] = await db
      .select({ lastSyncAt: crmSyncConnections.lastSyncAt })
      .from(crmSyncConnections)
      .where(eq(crmSyncConnections.workspaceId, workspaceId))
      .orderBy(desc(crmSyncConnections.lastSyncAt))
      .limit(1);

    // Count total records synced (sum of all log entries)
    const [syncedResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${crmSyncLogs.recordsCreated} + ${crmSyncLogs.recordsUpdated}), 0)::int`,
      })
      .from(crmSyncLogs)
      .where(eq(crmSyncLogs.workspaceId, workspaceId));

    // Count errors
    const [errorResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${crmSyncLogs.recordsErrored}), 0)::int`,
      })
      .from(crmSyncLogs)
      .where(eq(crmSyncLogs.workspaceId, workspaceId));

    return {
      connections: connResult?.count ?? 0,
      lastSync: latestSync?.lastSyncAt ?? null,
      totalSynced: syncedResult?.total ?? 0,
      errors: errorResult?.total ?? 0,
    };
  }
}

// Singleton export
export const syncService = new SyncService();
