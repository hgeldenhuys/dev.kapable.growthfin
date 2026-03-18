/**
 * Table Schema Management Routes
 *
 * Endpoints for managing table schemas and storage modes:
 * - PUT /v1/tables/:table - Create or update table schema
 * - GET /v1/tables/:table/schema - Get table schema
 * - POST /v1/tables/:table/migrate - Migrate storage mode
 * - DELETE /v1/tables/:table - Delete table
 */

import { connectionManager, RemoteDataError } from '../lib/connection-manager';
import { getTableMetadata } from '../lib/query-builder';
import {
  validateTableName,
  validateFieldName,
  createTypedTable,
  dropTypedTable,
  addColumn,
  removeColumn,
  migrateToTyped,
  migrateToJsonb,
  updateTableStorageMode,
  upsertTableRegistry,
} from '../lib/schema-manager';
import {
  compileRscSource,
  registerSchema,
  removeSchema,
} from '../services/rsc-validator';
import type { ApiContext, TableSchema, TableSettings, FieldDefinition } from '../types';

/**
 * PUT /v1/tables/:table - Create or update table schema
 *
 * Body:
 * {
 *   "display_name": "Leads",
 *   "schema": {
 *     "fields": [
 *       { "name": "name", "type": "text", "required": true },
 *       { "name": "email", "type": "text" },
 *       { "name": "status", "type": "select", "options": ["new", "qualified", "won"] },
 *       { "name": "value", "type": "number", "default": 0 }
 *     ]
 *   },
 *   "settings": {
 *     "storage_mode": "typed"  // or "jsonb" (default)
 *   }
 * }
 */
export async function upsertTable(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  // Check write scope
  if (!ctx.scopes.includes('write')) {
    return Response.json({ error: 'Write access required' }, { status: 403 });
  }

  // Validate table name
  const tableValidation = validateTableName(table);
  if (!tableValidation.valid) {
    return Response.json({ error: tableValidation.error }, { status: 400 });
  }

  // Parse body
  let body: {
    display_name?: string;
    schema?: TableSchema;
    settings?: TableSettings;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate schema fields
  if (body.schema?.fields) {
    for (const field of body.schema.fields) {
      const fieldValidation = validateFieldName(field.name);
      if (!fieldValidation.valid) {
        return Response.json({
          error: `Invalid field '${field.name}': ${fieldValidation.error}`
        }, { status: 400 });
      }

      // Validate field type
      const validTypes = ['text', 'number', 'boolean', 'date', 'select', 'json'];
      if (!validTypes.includes(field.type)) {
        return Response.json({
          error: `Invalid field type '${field.type}' for field '${field.name}'`
        }, { status: 400 });
      }
    }
  }

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Get existing table metadata
    const existingMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);

    const newSchema: TableSchema = body.schema || existingMeta?.schema || { fields: [] };
    const newSettings: TableSettings = {
      ...existingMeta?.settings,
      ...body.settings,
    };
    const newStorageMode = newSettings.storage_mode || 'jsonb';
    const existingStorageMode = existingMeta?.storage_mode || 'jsonb';

    // If changing to typed mode, we need to create the actual table
    if (newStorageMode === 'typed' && existingStorageMode === 'jsonb') {
      // Create typed table (but don't migrate data yet - that requires explicit migration call)
      await createTypedTable(
        projectSql,
        useSchema ? schema : null,
        table,
        newSchema,
        ctx.projectId
      );
    }

    // Update registry
    await upsertTableRegistry(
      projectSql,
      useSchema ? schema : null,
      table,
      body.display_name || existingMeta?.display_name || table,
      newSchema,
      newSettings
    );

    // Get updated metadata
    const updatedMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);

    return Response.json({
      name: table,
      display_name: updatedMeta?.display_name || table,
      schema: updatedMeta?.schema || newSchema,
      settings: updatedMeta?.settings || newSettings,
      storage_mode: updatedMeta?.storage_mode || newStorageMode,
      created_at: updatedMeta?.created_at,
      updated_at: updatedMeta?.updated_at,
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }

    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}

/**
 * GET /v1/tables/:table/schema - Get table schema
 */
export async function getTableSchema(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    const tableMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);

    if (!tableMeta) {
      return Response.json({ error: 'Table not found' }, { status: 404 });
    }

    return Response.json({
      name: table,
      display_name: tableMeta.display_name,
      schema: tableMeta.schema,
      settings: tableMeta.settings,
      storage_mode: tableMeta.storage_mode,
      created_at: tableMeta.created_at,
      updated_at: tableMeta.updated_at,
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * POST /v1/tables/:table/migrate - Migrate storage mode
 *
 * Body:
 * {
 *   "target_mode": "typed" | "jsonb"
 * }
 */
export async function migrateTable(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  // Check write scope
  if (!ctx.scopes.includes('write')) {
    return Response.json({ error: 'Write access required' }, { status: 403 });
  }

  // Parse body
  let body: { target_mode: 'typed' | 'jsonb' };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.target_mode || !['typed', 'jsonb'].includes(body.target_mode)) {
    return Response.json({
      error: 'target_mode must be "typed" or "jsonb"'
    }, { status: 400 });
  }

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Get table metadata
    const tableMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);

    if (!tableMeta) {
      return Response.json({ error: 'Table not found' }, { status: 404 });
    }

    const currentMode = tableMeta.storage_mode || 'jsonb';

    if (currentMode === body.target_mode) {
      return Response.json({
        message: `Table already in ${body.target_mode} mode`,
        migrated: 0,
      });
    }

    let result: { migrated: number };

    if (body.target_mode === 'typed') {
      // Migrate from JSONB to typed
      result = await migrateToTyped(
        projectSql,
        useSchema ? schema : null,
        table,
        tableMeta.schema,
        ctx.projectId
      );
      await updateTableStorageMode(projectSql, useSchema ? schema : null, table, 'typed');
    } else {
      // Migrate from typed to JSONB
      result = await migrateToJsonb(
        projectSql,
        useSchema ? schema : null,
        table,
        tableMeta.schema
      );
      await updateTableStorageMode(projectSql, useSchema ? schema : null, table, 'jsonb');
    }

    return Response.json({
      message: `Successfully migrated to ${body.target_mode} mode`,
      migrated: result.migrated,
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }

    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    throw error;
  }
}

/**
 * DELETE /v1/tables/:table - Delete table and all data
 */
export async function deleteTable(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  // Check write scope
  if (!ctx.scopes.includes('write')) {
    return Response.json({ error: 'Write access required' }, { status: 403 });
  }

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Get table metadata
    const tableMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);

    if (!tableMeta) {
      return Response.json({ error: 'Table not found' }, { status: 404 });
    }

    const storageMode = tableMeta.storage_mode || 'jsonb';

    if (storageMode === 'typed') {
      // Drop the typed table
      await dropTypedTable(projectSql, useSchema ? schema : null, table);
    } else {
      // Delete all rows from _data
      const dataTableRef = useSchema ? `"${schema}"."_data"` : '"_data"';
      try {
        await projectSql.unsafe(
          `DELETE FROM ${dataTableRef} WHERE table_name = $1`,
          [table]
        );
      } catch {
        // Fall back to old table name
        const fallbackRef = useSchema ? `"${schema}"."data"` : '"data"';
        await projectSql.unsafe(
          `DELETE FROM ${fallbackRef} WHERE table_name = $1`,
          [table]
        );
      }
    }

    // Delete from registry
    const registryRef = useSchema ? `"${schema}"."_tables"` : '"_tables"';
    try {
      await projectSql.unsafe(
        `DELETE FROM ${registryRef} WHERE name = $1`,
        [table]
      );
    } catch {
      // Fall back to old table name
      const fallbackRef = useSchema ? `"${schema}"."tables"` : '"tables"';
      await projectSql.unsafe(
        `DELETE FROM ${fallbackRef} WHERE name = $1`,
        [table]
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * GET /v1/tables - List all tables
 */
export async function listTables(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    const registryRef = useSchema ? `"${schema}"."_tables"` : '"_tables"';

    let tables;
    try {
      tables = await projectSql.unsafe(
        `SELECT name, display_name, schema, settings,
                COALESCE(storage_mode, 'jsonb') as storage_mode,
                created_at, updated_at
         FROM ${registryRef}
         ORDER BY name`
      );
    } catch {
      // Fall back to old table name
      const fallbackRef = useSchema ? `"${schema}"."tables"` : '"tables"';
      tables = await projectSql.unsafe(
        `SELECT name, display_name, schema, settings,
                'jsonb' as storage_mode,
                created_at, updated_at
         FROM ${fallbackRef}
         ORDER BY name`
      );
    }

    return Response.json({
      tables: tables.map(t => ({
        name: t.name,
        display_name: t.display_name,
        schema: t.schema,
        settings: t.settings,
        storage_mode: t.storage_mode,
        created_at: t.created_at,
        updated_at: t.updated_at,
      })),
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }
    throw error;
  }
}

// ============================================================================
// RSC Schema Management Endpoints
// ============================================================================

/**
 * PUT /v1/_meta/tables/:table/rsc - Upload RSC schema for a table
 *
 * Accepts RSC source code, compiles it via WASM, and stores the
 * CompiledSchema on the _tables registry for validation.
 *
 * Body: { "source": "entity Account { balance: i64; }" }
 */
export async function putRscSchema(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  let body: { source: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.source || typeof body.source !== 'string') {
    return Response.json({ error: 'Missing "source" field with RSC source code' }, { status: 400 });
  }

  try {
    // Compile RSC source
    const compileResult = await compileRscSource(body.source);

    if (!compileResult.success || !compileResult.schema) {
      return Response.json({
        error: 'RSC compilation failed',
        diagnostics: compileResult.errors,
      }, { status: 422 });
    }

    // Get project connection
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;
    const tableRef = useSchema ? `"${schema}"."_tables"` : '"_tables"';

    // Store compiled schema and source on _tables
    await projectSql.unsafe(
      `UPDATE ${tableRef}
       SET rsc_schema = $1::jsonb,
           rsc_source = $2,
           updated_at = NOW()
       WHERE name = $3`,
      [JSON.stringify(compileResult.schema), body.source, table]
    );

    // Register in memory cache
    registerSchema(ctx.projectId, table, compileResult.schema as any);

    return Response.json({
      success: true,
      schema: compileResult.schema,
      warnings: compileResult.warnings ?? [],
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * GET /v1/_meta/tables/:table/rsc - Get RSC schema for a table
 */
export async function getRscSchema(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;
    const tableRef = useSchema ? `"${schema}"."_tables"` : '"_tables"';

    const result = await projectSql.unsafe(
      `SELECT rsc_schema, rsc_source FROM ${tableRef} WHERE name = $1 LIMIT 1`,
      [table]
    );

    if (result.length === 0) {
      return Response.json({ error: 'Table not found' }, { status: 404 });
    }

    const row = result[0];
    if (!row.rsc_schema) {
      return Response.json({ error: 'No RSC schema configured for this table' }, { status: 404 });
    }

    return Response.json({
      schema: row.rsc_schema,
      source: row.rsc_source,
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * DELETE /v1/_meta/tables/:table/rsc - Remove RSC schema from a table
 */
export async function deleteRscSchema(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;
    const tableRef = useSchema ? `"${schema}"."_tables"` : '"_tables"';

    await projectSql.unsafe(
      `UPDATE ${tableRef}
       SET rsc_schema = NULL,
           rsc_source = NULL,
           updated_at = NOW()
       WHERE name = $1`,
      [table]
    );

    // Remove from memory cache
    removeSchema(ctx.projectId, table);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: { server: error.serverHost, serverId: error.serverId }
      }, { status: 307 });
    }
    throw error;
  }
}
