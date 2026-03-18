/**
 * Row routes: GET/PUT/DELETE /v1/:table/:id
 *
 * Uses schema-isolated queries for hobbyist tier, direct queries for pro/enterprise.
 * Supports both JSONB storage (_data table) and typed tables (real columns).
 * Connection routing handled by connection-manager.
 * RLS context is set for JWT tokens to enable row-level filtering.
 */

import { sql } from '../lib/db';
import { connectionManager, RemoteDataError } from '../lib/connection-manager';
import { getTableMetadata } from '../lib/query-builder';
import { withTokenRLS } from '../lib/rls-context';
import { validateRow, loadSchemaFromMetadata } from '../services/rsc-validator';
import type { ApiContext, TableMetadata } from '../types';

/**
 * GET /v1/:table/:id - Get single row
 */
export async function getRow(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table, id } = params;

  try {
    // Get project-specific database connection
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);

    // For hobbyist tier: use schema isolation
    // For pro/enterprise tier: tables are in public schema of dedicated database
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Execute query with RLS context (wraps in transaction for JWT tokens)
    return await withTokenRLS(projectSql, ctx, async (txSql) => {
      // Get table metadata to determine storage mode
      const tableMeta = await getTableMetadata(txSql, useSchema ? schema : null, table);

      if (!tableMeta) {
        return Response.json({ error: 'Table not found' }, { status: 404 });
      }

      const storageMode = tableMeta.storage_mode || 'jsonb';
      let result: Record<string, unknown>[];

      if (storageMode === 'typed') {
        // Query typed table
        const tableRef = useSchema ? `"${schema}"."${table}"` : `"${table}"`;
        result = await txSql.unsafe(
          `SELECT * FROM ${tableRef} WHERE id = $1 LIMIT 1`,
          [id]
        );

        if (result.length === 0) {
          return Response.json({ error: 'Row not found' }, { status: 404 });
        }

        const row = result[0];
        return Response.json({
          id: row.id,
          ...Object.fromEntries(
            Object.entries(row).filter(([key]) =>
              !['_extras', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)
            )
          ),
          ...(row._extras as Record<string, unknown> || {}),
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      } else {
        // Query JSONB storage
        result = await queryJsonbRowTx(txSql, useSchema ? schema : null, table, id);

        if (result.length === 0) {
          return Response.json({ error: 'Row not found' }, { status: 404 });
        }

        const row = result[0];
        return Response.json({
          id: row.id,
          ...(row.data as Record<string, unknown>),
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: {
          server: error.serverHost,
          serverId: error.serverId,
        }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * Query a row from JSONB storage (tries _data, falls back to data)
 * Uses transaction connection for RLS context
 */
async function queryJsonbRowTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txSql: any,
  schema: string | null,
  tableName: string,
  id: string
): Promise<Record<string, unknown>[]> {
  const tableRefNew = schema ? `"${schema}"."_data"` : '"_data"';
  const tableRefOld = schema ? `"${schema}"."data"` : '"data"';

  try {
    return await txSql.unsafe(
      `SELECT id, data, created_at, updated_at
       FROM ${tableRefNew}
       WHERE table_name = $1 AND id = $2
       LIMIT 1`,
      [tableName, id]
    );
  } catch {
    return await txSql.unsafe(
      `SELECT id, data, created_at, updated_at
       FROM ${tableRefOld}
       WHERE table_name = $1 AND id = $2
       LIMIT 1`,
      [tableName, id]
    );
  }
}

/**
 * PUT /v1/:table/:id - Update row
 *
 * Supports both JSONB storage and typed tables.
 */
export async function updateRow(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table, id } = params;
  const isPatch = req.method === 'PATCH';

  // Check write scope
  if (!ctx.scopes.includes('write')) {
    return Response.json({ error: 'Write access required' }, { status: 403 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Strip reserved fields from body to prevent corruption
  const { id: _id, created_at: _ca, updated_at: _ua, ...cleanBody } = body;

  try {
    // Get project-specific database connection
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);

    // For hobbyist tier: use schema isolation
    // For pro/enterprise tier: tables are in public schema of dedicated database
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Execute query with RLS context (wraps in transaction for JWT tokens)
    return await withTokenRLS(projectSql, ctx, async (txSql) => {
      // Get table metadata to determine storage mode
      const tableMeta = await getTableMetadata(txSql, useSchema ? schema : null, table);

      if (!tableMeta) {
        return Response.json({ error: 'Table not found' }, { status: 404 });
      }

      const storageMode = tableMeta.storage_mode || 'jsonb';

      // RSC schema validation (if schema exists for this table)
      if (tableMeta.rsc_schema) {
        loadSchemaFromMetadata(ctx.projectId, table, tableMeta.rsc_schema as any);
        const validation = await validateRow(ctx.projectId, table, cleanBody);
        if (validation && !validation.valid) {
          return Response.json({
            error: 'Validation failed',
            validation_errors: validation.errors,
          }, { status: 422 });
        }
      }

      let result: Record<string, unknown>[];

      if (storageMode === 'typed') {
        // Update typed table
        result = await updateTypedRowTx(txSql, useSchema ? schema : null, table, id, cleanBody, tableMeta);

        if (result.length === 0) {
          return Response.json({ error: 'Row not found' }, { status: 404 });
        }

        const row = result[0];
        return Response.json({
          id: row.id,
          ...Object.fromEntries(
            Object.entries(row).filter(([key]) =>
              !['_extras', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)
            )
          ),
          ...(row._extras as Record<string, unknown> || {}),
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      } else {
        // Update JSONB storage — PATCH merges, PUT replaces
        result = await updateJsonbRowTx(txSql, useSchema ? schema : null, table, id, cleanBody, isPatch);

        if (result.length === 0) {
          return Response.json({ error: 'Row not found' }, { status: 404 });
        }

        const row = result[0];
        return Response.json({
          id: row.id,
          ...(row.data as Record<string, unknown>),
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: {
          server: error.serverHost,
          serverId: error.serverId,
        }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * Update row in JSONB storage (tries _data, falls back to data)
 * Uses transaction connection for RLS context
 *
 * When merge=true (PATCH), uses PostgreSQL || operator to merge into existing data.
 * When merge=false (PUT), replaces the entire data column.
 */
async function updateJsonbRowTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txSql: any,
  schema: string | null,
  tableName: string,
  id: string,
  data: Record<string, unknown>,
  merge: boolean = false
): Promise<Record<string, unknown>[]> {
  const tableRefNew = schema ? `"${schema}"."_data"` : '"_data"';
  const tableRefOld = schema ? `"${schema}"."data"` : '"data"';

  const setClause = merge
    ? `data = (COALESCE(data, '{}'::jsonb) || $1::jsonb)`
    : `data = $1::jsonb`;

  try {
    return await txSql.unsafe(
      `UPDATE ${tableRefNew}
       SET ${setClause}, updated_at = NOW()
       WHERE table_name = $2 AND id = $3
       RETURNING id, data, created_at, updated_at`,
      [data, tableName, id]
    );
  } catch {
    return await txSql.unsafe(
      `UPDATE ${tableRefOld}
       SET ${setClause}, updated_at = NOW()
       WHERE table_name = $2 AND id = $3
       RETURNING id, data, created_at, updated_at`,
      [data, tableName, id]
    );
  }
}

/**
 * Update row in typed table
 * Uses transaction connection for RLS context
 */
async function updateTypedRowTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txSql: any,
  schema: string | null,
  tableName: string,
  id: string,
  data: Record<string, unknown>,
  tableMeta: TableMetadata
): Promise<Record<string, unknown>[]> {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;

  // Separate known fields from extras
  const knownFieldNames = new Set(tableMeta.schema.fields?.map(f => f.name) || []);
  const knownData: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (knownFieldNames.has(key)) {
      knownData[key] = value;
    } else {
      extras[key] = value;
    }
  }

  // Build SET clause
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(knownData)) {
    setClauses.push(`"${key}" = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  // Handle _extras
  if (Object.keys(extras).length > 0) {
    setClauses.push(`_extras = $${paramIndex}`);
    values.push(JSON.stringify(extras));
    paramIndex++;
  }

  // Always update updated_at
  setClauses.push('updated_at = NOW()');

  // Add id to values
  values.push(id);

  if (setClauses.length === 1) {
    // Only updated_at, no actual data changes
    return await txSql.unsafe(
      `UPDATE ${tableRef}
       SET updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
  }

  return await txSql.unsafe(
    `UPDATE ${tableRef}
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );
}

/**
 * DELETE /v1/:table/:id - Delete row
 *
 * Supports both JSONB storage and typed tables.
 */
export async function deleteRow(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table, id } = params;

  // Check write scope
  if (!ctx.scopes.includes('write')) {
    return Response.json({ error: 'Write access required' }, { status: 403 });
  }

  try {
    // Get project-specific database connection
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);

    // For hobbyist tier: use schema isolation
    // For pro/enterprise tier: tables are in public schema of dedicated database
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Execute query with RLS context (wraps in transaction for JWT tokens)
    return await withTokenRLS(projectSql, ctx, async (txSql) => {
      // Get table metadata to determine storage mode
      const tableMeta = await getTableMetadata(txSql, useSchema ? schema : null, table);

      if (!tableMeta) {
        return Response.json({ error: 'Table not found' }, { status: 404 });
      }

      const storageMode = tableMeta.storage_mode || 'jsonb';
      let result: Record<string, unknown>[];

      if (storageMode === 'typed') {
        // Delete from typed table
        const tableRef = useSchema ? `"${schema}"."${table}"` : `"${table}"`;
        result = await txSql.unsafe(
          `DELETE FROM ${tableRef} WHERE id = $1 RETURNING id`,
          [id]
        );
      } else {
        // Delete from JSONB storage
        result = await deleteJsonbRowTx(txSql, useSchema ? schema : null, table, id);
      }

      if (result.length === 0) {
        return Response.json({ error: 'Row not found' }, { status: 404 });
      }

      return new Response(null, { status: 204 });
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      return Response.json({
        error: 'Data located on different server',
        redirect: {
          server: error.serverHost,
          serverId: error.serverId,
        }
      }, { status: 307 });
    }
    throw error;
  }
}

/**
 * Delete row from JSONB storage (tries _data, falls back to data)
 * Uses transaction connection for RLS context
 */
async function deleteJsonbRowTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txSql: any,
  schema: string | null,
  tableName: string,
  id: string
): Promise<Record<string, unknown>[]> {
  const tableRefNew = schema ? `"${schema}"."_data"` : '"_data"';
  const tableRefOld = schema ? `"${schema}"."data"` : '"data"';

  try {
    return await txSql.unsafe(
      `DELETE FROM ${tableRefNew}
       WHERE table_name = $1 AND id = $2
       RETURNING id`,
      [tableName, id]
    );
  } catch {
    return await txSql.unsafe(
      `DELETE FROM ${tableRefOld}
       WHERE table_name = $1 AND id = $2
       RETURNING id`,
      [tableName, id]
    );
  }
}
