/**
 * CRM Data Sync Routes (Phase V)
 *
 * REST endpoints for managing CRM sync connections, field mappings,
 * and triggering/monitoring synchronization with external CRM systems.
 *
 * Prefix: /sync (mounted under /crm)
 */

import { Elysia, t } from 'elysia';
import { syncService } from '../services/sync/sync.service';

// ============================================================================
// CRM SYNC ROUTES
// ============================================================================

export const crmSyncRoutes = new Elysia({ prefix: '/sync' })

  // ==========================================================================
  // Connections
  // ==========================================================================

  .get(
    '/connections',
    async ({ db, query }) => {
      const connections = await syncService.listConnections(db, query.workspaceId);
      return { connections };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'List sync connections',
        description: 'List all CRM sync connections for a workspace',
      },
    }
  )

  .post(
    '/connections',
    async ({ db, body, set }) => {
      try {
        const connection = await syncService.createConnection(db, {
          workspaceId: body.workspaceId,
          provider: body.provider,
          name: body.name,
          syncDirection: body.syncDirection ?? 'bidirectional',
          syncFrequencyMinutes: body.syncFrequencyMinutes ?? 15,
          createdBy: body.createdBy ?? null,
        });

        set.status = 201;
        return connection;
      } catch (error) {
        console.error('[crm-sync/connections POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create connection',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        provider: t.String(), // 'salesforce' | 'hubspot'
        name: t.String(),
        syncDirection: t.Optional(t.String()),
        syncFrequencyMinutes: t.Optional(t.Number()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Create sync connection',
        description: 'Create a new CRM sync connection. Use OAuth flow to complete setup.',
      },
    }
  )

  .get(
    '/connections/:id',
    async ({ db, params, query }) => {
      const connection = await syncService.getConnection(db, params.id, query.workspaceId);

      if (!connection) {
        return { error: 'Connection not found' };
      }

      // Get recent sync logs
      const recentLogs = await syncService.listSyncLogs(db, params.id, query.workspaceId, 10);

      return { connection, recentLogs };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Get sync connection',
        description: 'Get a sync connection with its recent sync logs',
      },
    }
  )

  .patch(
    '/connections/:id',
    async ({ db, params, body, set }) => {
      try {
        const updateData: Record<string, unknown> = {};
        if (body['name'] !== undefined) updateData['name'] = body['name'];
        if (body['syncDirection'] !== undefined) updateData['syncDirection'] = body['syncDirection'];
        if (body['syncEnabled'] !== undefined) updateData['syncEnabled'] = body['syncEnabled'];
        if (body['syncFrequencyMinutes'] !== undefined) updateData['syncFrequencyMinutes'] = body['syncFrequencyMinutes'];

        const updated = await syncService.updateConnection(
          db,
          params.id,
          body['workspaceId'],
          updateData,
        );

        if (!updated) {
          set.status = 404;
          return { error: 'Connection not found' };
        }

        return updated;
      } catch (error) {
        console.error('[crm-sync/connections PATCH] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to update connection',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        syncDirection: t.Optional(t.String()),
        syncEnabled: t.Optional(t.Boolean()),
        syncFrequencyMinutes: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Update sync connection',
        description: 'Update an existing sync connection',
      },
    }
  )

  .delete(
    '/connections/:id',
    async ({ db, params, query, set }) => {
      const deleted = await syncService.deleteConnection(db, params.id, query.workspaceId);

      if (!deleted) {
        set.status = 404;
        return { error: 'Connection not found' };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Delete sync connection',
        description: 'Delete a sync connection and all associated mappings and logs',
      },
    }
  )

  // ==========================================================================
  // Sync trigger
  // ==========================================================================

  .post(
    '/connections/:id/sync',
    async ({ db, params, body, set }) => {
      try {
        const syncType = body.type ?? 'delta';
        const log = await syncService.runSync(
          db,
          params.id,
          body.workspaceId,
          syncType as 'full' | 'delta' | 'manual',
        );
        return { syncLog: log };
      } catch (error) {
        console.error('[crm-sync/sync POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to run sync',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        type: t.Optional(t.String()), // 'full' | 'delta' | 'manual'
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Trigger manual sync',
        description: 'Trigger a manual sync for a connection. Defaults to delta (incremental) sync.',
      },
    }
  )

  // ==========================================================================
  // OAuth flow
  // ==========================================================================

  .get(
    '/connections/:id/oauth-url',
    async ({ db, params, query, set }) => {
      try {
        const connection = await syncService.getConnection(db, params.id, query.workspaceId);
        if (!connection) {
          set.status = 404;
          return { error: 'Connection not found' };
        }

        const adapter = syncService.getAdapter(connection);
        const redirectUri = query.redirectUri || `${process.env['API_URL'] || 'http://localhost:3000'}/api/v1/crm/sync/connections/${params.id}/oauth-callback`;
        const state = JSON.stringify({
          connectionId: params.id,
          workspaceId: query.workspaceId,
        });

        const url = adapter.getAuthUrl(redirectUri, state);
        return { url };
      } catch (error) {
        console.error('[crm-sync/oauth-url GET] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to generate OAuth URL',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        redirectUri: t.Optional(t.String()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Get OAuth authorization URL',
        description: 'Generate the OAuth URL for connecting to the external CRM',
      },
    }
  )

  .post(
    '/connections/:id/oauth-callback',
    async ({ db, params, body, set }) => {
      try {
        const connection = await syncService.getConnection(db, params.id, body.workspaceId);
        if (!connection) {
          set.status = 404;
          return { error: 'Connection not found' };
        }

        const adapter = syncService.getAdapter(connection);
        const redirectUri = body.redirectUri || `${process.env['API_URL'] || 'http://localhost:3000'}/api/v1/crm/sync/connections/${params.id}/oauth-callback`;

        const tokens = await adapter.exchangeToken(body.code, redirectUri);

        // Update connection with tokens
        const updated = await syncService.updateConnection(db, params.id, body.workspaceId, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          instanceUrl: tokens.instanceUrl ?? null,
          externalAccountId: tokens.externalAccountId,
        });

        return {
          success: true,
          connection: updated,
        };
      } catch (error) {
        console.error('[crm-sync/oauth-callback POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'OAuth callback failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        code: t.String(),
        redirectUri: t.Optional(t.String()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'OAuth callback',
        description: 'Exchange an OAuth authorization code for access tokens',
      },
    }
  )

  // ==========================================================================
  // Field Mappings
  // ==========================================================================

  .get(
    '/connections/:id/mappings',
    async ({ db, params, query }) => {
      const mappings = await syncService.listFieldMappings(
        db,
        params.id,
        query.workspaceId,
        query.entityType,
      );
      return { mappings };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Optional(t.String()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'List field mappings',
        description: 'List field mappings for a connection, optionally filtered by entity type',
      },
    }
  )

  .post(
    '/connections/:id/mappings',
    async ({ db, params, body, set }) => {
      try {
        const mapping = await syncService.createFieldMapping(db, {
          connectionId: params.id,
          workspaceId: body.workspaceId,
          entityType: body.entityType,
          localField: body.localField,
          externalField: body.externalField,
          direction: body.direction ?? 'bidirectional',
          transformType: body.transformType ?? 'none',
          transformConfig: body.transformConfig ?? null,
          isRequired: body.isRequired ?? false,
          isKey: body.isKey ?? false,
        });

        set.status = 201;
        return mapping;
      } catch (error) {
        console.error('[crm-sync/mappings POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create field mapping',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        entityType: t.String(),
        localField: t.String(),
        externalField: t.String(),
        direction: t.Optional(t.String()),
        transformType: t.Optional(t.String()),
        transformConfig: t.Optional(t.Any()),
        isRequired: t.Optional(t.Boolean()),
        isKey: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Create field mapping',
        description: 'Create a field mapping between NewLeads and external CRM',
      },
    }
  )

  .patch(
    '/mappings/:id',
    async ({ db, params, body, set }) => {
      try {
        const updateData: Record<string, unknown> = {};
        if (body['localField'] !== undefined) updateData['localField'] = body['localField'];
        if (body['externalField'] !== undefined) updateData['externalField'] = body['externalField'];
        if (body['direction'] !== undefined) updateData['direction'] = body['direction'];
        if (body['transformType'] !== undefined) updateData['transformType'] = body['transformType'];
        if (body['transformConfig'] !== undefined) updateData['transformConfig'] = body['transformConfig'];
        if (body['isRequired'] !== undefined) updateData['isRequired'] = body['isRequired'];
        if (body['isKey'] !== undefined) updateData['isKey'] = body['isKey'];

        const updated = await syncService.updateFieldMapping(
          db,
          params.id,
          body['workspaceId'],
          updateData,
        );

        if (!updated) {
          set.status = 404;
          return { error: 'Field mapping not found' };
        }

        return updated;
      } catch (error) {
        console.error('[crm-sync/mappings PATCH] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to update field mapping',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        localField: t.Optional(t.String()),
        externalField: t.Optional(t.String()),
        direction: t.Optional(t.String()),
        transformType: t.Optional(t.String()),
        transformConfig: t.Optional(t.Any()),
        isRequired: t.Optional(t.Boolean()),
        isKey: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Update field mapping',
        description: 'Update an existing field mapping',
      },
    }
  )

  .delete(
    '/mappings/:id',
    async ({ db, params, query, set }) => {
      const deleted = await syncService.deleteFieldMapping(db, params.id, query.workspaceId);

      if (!deleted) {
        set.status = 404;
        return { error: 'Field mapping not found' };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Delete field mapping',
        description: 'Delete a field mapping',
      },
    }
  )

  .get(
    '/connections/:id/available-fields',
    async ({ db, params, query, set }) => {
      try {
        const connection = await syncService.getConnection(db, params.id, query.workspaceId);
        if (!connection) {
          set.status = 404;
          return { error: 'Connection not found' };
        }

        const adapter = syncService.getAdapter(connection);
        const fields = await adapter.getAvailableFields(query.entityType);
        return { fields };
      } catch (error) {
        console.error('[crm-sync/available-fields GET] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch available fields',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.String(),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Get available external CRM fields',
        description: 'Get available fields from the external CRM for a given entity type. Used for field mapping configuration.',
      },
    }
  )

  // ==========================================================================
  // Sync Logs
  // ==========================================================================

  .get(
    '/connections/:id/logs',
    async ({ db, params, query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const logs = await syncService.listSyncLogs(
        db,
        params.id,
        query.workspaceId,
        limit,
      );
      return { logs };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'List sync logs',
        description: 'List sync log entries for a connection',
      },
    }
  )

  // ==========================================================================
  // Statistics
  // ==========================================================================

  .get(
    '/stats',
    async ({ db, query }) => {
      const stats = await syncService.getSyncStats(db, query.workspaceId);
      return stats;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Get sync statistics',
        description: 'Get overall sync statistics for a workspace',
      },
    }
  )

  // ==========================================================================
  // Duplicate detection (preview)
  // ==========================================================================

  .post(
    '/check-duplicates',
    async ({ db, body, set }) => {
      try {
        const duplicateId = await syncService.findDuplicate(
          db,
          body.workspaceId,
          body.entityType,
          body.data,
        );
        return {
          hasDuplicate: !!duplicateId,
          existingId: duplicateId,
        };
      } catch (error) {
        console.error('[crm-sync/check-duplicates POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to check duplicates',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        entityType: t.String(),
        data: t.Record(t.String(), t.Any()),
      }),
      detail: {
        tags: ['CRM Sync'],
        summary: 'Check for duplicates',
        description: 'Check if a record would create a duplicate before syncing. Returns the existing record ID if a match is found.',
      },
    }
  );
