/**
 * Table routes: GET/POST /v1/:table
 *
 * Uses schema-isolated queries for data access.
 * Supports filter query API: ?filter[field]=value&filter[field][op]=value
 * Connection routing handled by connection-manager for Pro/Enterprise tiers.
 * RLS context is set for JWT tokens to enable row-level filtering.
 */

import { sql } from '../lib/db';
import { connectionManager, RemoteDataError } from '../lib/connection-manager';
import {
  parseListParams,
  getTableMetadata,
  buildJsonbListQuery,
  buildTypedListQuery,
} from '../lib/query-builder';
import { withTokenRLS } from '../lib/rls-context';
import { validateRow, loadSchemaFromMetadata } from '../services/rsc-validator';
import { checkRowLimitForBatch } from '../lib/usage-enforcement';
import type { ApiContext, TableMetadata } from '../types';

const MAX_BATCH_SIZE = 1000;

/**
 * GET /v1/:table - List rows with pagination and filtering
 *
 * Query parameters:
 * - limit: Max rows to return (default 100, max 1000)
 * - offset: Rows to skip (default 0)
 * - orderBy: Field to order by (default 'created_at')
 * - order: Sort order 'asc' or 'desc' (default 'desc')
 * - filter[field]: Filter by field value (equals)
 * - filter[field][op]: Filter with operator (eq, ne, gt, gte, lt, lte, in, contains, starts, isnull)
 *
 * Examples:
 * - /v1/leads?filter[status]=active
 * - /v1/leads?filter[value][gt]=1000
 * - /v1/leads?filter[status][in]=new,qualified
 * - /v1/leads?filter[name][contains]=smith
 */
export async function listRows(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;
  const url = new URL(req.url);

  try {
    // Parse query parameters including filters
    const listParams = parseListParams(url.searchParams);

    // Get project-specific database connection
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);

    // For hobbyist tier: use schema isolation (e.g., project_xxx._tables)
    // For pro/enterprise tier: tables are in public schema of dedicated database
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // Execute query with RLS context (wraps in transaction for JWT tokens)
    return await withTokenRLS(projectSql, ctx, async (txSql) => {
      // Get table metadata (includes schema for field type info)
      const tableMeta = await getTableMetadata(txSql, useSchema ? schema : null, table);

      if (!tableMeta) {
        return Response.json({ error: 'Table not found' }, { status: 404 });
      }

      // Determine storage mode
      const storageMode = tableMeta.storage_mode || 'jsonb';

      let rows: Record<string, unknown>[];
      let total: number;

      if (storageMode === 'typed') {
        // Query typed table (real PostgreSQL columns)
        const { query, countQuery, values } = buildTypedListQuery(
          useSchema ? schema : null,
          table,
          listParams,
          tableMeta
        );

        rows = await txSql.unsafe(query, values);
        const countResult = await txSql.unsafe(countQuery, values);
        total = Number(countResult[0].count);

        // Transform rows (no need to extract from data JSONB)
        const data = rows.map(row => ({
          id: row.id,
          ...Object.fromEntries(
            Object.entries(row).filter(([key]) =>
              !['_extras', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)
            )
          ),
          // Spread _extras if present
          ...(row._extras as Record<string, unknown> || {}),
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        return Response.json({
          data,
          meta: {
            total,
            limit: listParams.limit,
            offset: listParams.offset,
            storage_mode: storageMode,
          },
        });
      } else {
        // Query JSONB storage (existing behavior with filters)
        const { query, countQuery, values } = buildJsonbListQuery(
          useSchema ? schema : null,
          table,
          listParams,
          tableMeta
        );

        rows = await txSql.unsafe(query, values);
        const countResult = await txSql.unsafe(countQuery, values);
        total = Number(countResult[0].count);

        // Transform rows
        const data = rows.map(row => ({
          id: row.id,
          ...(row.data as Record<string, unknown>),
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        return Response.json({
          data,
          meta: {
            total,
            limit: listParams.limit,
            offset: listParams.offset,
            storage_mode: storageMode,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof RemoteDataError) {
      // Data is on a different server - return redirect info
      return Response.json({
        error: 'Data located on different server',
        redirect: {
          server: error.serverHost,
          serverId: error.serverId,
        }
      }, { status: 307 });
    }

    // Handle filter parsing errors
    if (error instanceof Error && error.message.includes('Invalid filter')) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}

/**
 * POST /v1/:table - Create row(s)
 *
 * Accepts a single object or an array of objects (bulk insert, max 1000).
 * Supports both JSONB storage and typed tables.
 * For typed tables, validates data against schema and inserts into real columns.
 *
 * Single: POST /v1/leads  body: {"name": "Alice"}           → 201 { id, name, ... }
 * Bulk:   POST /v1/leads  body: [{"name": "Alice"}, ...]    → 201 [{ id, name, ... }, ...]
 */
export async function createRow(
  req: Request,
  params: Record<string, string>,
  ctx: ApiContext
): Promise<Response> {
  const { table } = params;

  // Check write scope
  if (!ctx.scopes.includes('write')) {
    return Response.json({ error: 'Write access required' }, { status: 403 });
  }

  // Parse body — could be object or array
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const isBulk = Array.isArray(rawBody);

  // --- Bulk input validation ---
  if (isBulk) {
    const arr = rawBody as unknown[];
    if (arr.length === 0) {
      return Response.json({ error: 'Empty array' }, { status: 400 });
    }
    if (arr.length > MAX_BATCH_SIZE) {
      return Response.json({
        error: 'Batch too large',
        max_batch_size: MAX_BATCH_SIZE,
      }, { status: 400 });
    }
    // Validate every element is a non-null object (not array)
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return Response.json({
          error: 'Invalid row',
          message: `Item at index ${i} is not a valid object`,
        }, { status: 400 });
      }
    }
  } else if (rawBody === null || typeof rawBody !== 'object') {
    return Response.json({ error: 'Body must be a JSON object or array' }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = isBulk
    ? rawBody as Record<string, unknown>[]
    : [rawBody as Record<string, unknown>];

  try {
    // Get project-specific database connection
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);

    // For hobbyist tier: use schema isolation
    // For pro/enterprise tier: tables are in public schema of dedicated database
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    // --- Batch row limit pre-check ---
    if (isBulk) {
      const limitCheck = await checkRowLimitForBatch(ctx.orgId, rows.length);
      if (!limitCheck.allowed) {
        return Response.json({
          error: 'Row limit exceeded',
          current: limitCheck.current,
          limit: limitCheck.limit,
          batch_size: rows.length,
        }, { status: 429 });
      }
    }

    // Get table metadata (may not exist if auto-creating)
    let tableMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);

    // Auto-create table if it doesn't exist (always as JSONB)
    if (!tableMeta) {
      await ensureTableExists(projectSql, useSchema ? schema : null, table);
      tableMeta = await getTableMetadata(projectSql, useSchema ? schema : null, table);
    }

    const storageMode = tableMeta?.storage_mode || 'jsonb';

    // --- RSC schema validation ---
    if (tableMeta?.rsc_schema) {
      loadSchemaFromMetadata(ctx.projectId, table, tableMeta.rsc_schema as any);

      if (isBulk) {
        // Validate each row, collect indexed errors
        const validationErrors: { index: number; errors: unknown[] }[] = [];
        for (let i = 0; i < rows.length; i++) {
          const validation = await validateRow(ctx.projectId, table, rows[i]);
          if (validation && !validation.valid) {
            validationErrors.push({ index: i, errors: validation.errors });
          }
        }
        if (validationErrors.length > 0) {
          return Response.json({
            error: 'Validation failed',
            validation_errors: validationErrors,
          }, { status: 422 });
        }
      } else {
        const validation = await validateRow(ctx.projectId, table, rows[0]);
        if (validation && !validation.valid) {
          return Response.json({
            error: 'Validation failed',
            validation_errors: validation.errors,
          }, { status: 422 });
        }
      }
    }

    // --- Insert ---
    let result: Record<string, unknown>[];

    if (isBulk) {
      if (storageMode === 'typed' && tableMeta) {
        result = await bulkInsertTypedRows(projectSql, useSchema ? schema : null, table, rows, tableMeta);
      } else {
        result = await bulkInsertJsonbRows(projectSql, useSchema ? schema : null, table, rows);
      }
    } else {
      if (storageMode === 'typed' && tableMeta) {
        result = await insertTypedRow(projectSql, useSchema ? schema : null, table, rows[0], tableMeta);
      } else {
        result = await insertJsonbRow(projectSql, useSchema ? schema : null, table, rows[0]);
      }
    }

    if (result.length === 0) {
      return Response.json({ error: 'Failed to create row(s)' }, { status: 500 });
    }

    // --- Format response ---
    const formatted = result.map(row => {
      if (storageMode === 'typed') {
        return {
          id: row.id,
          ...Object.fromEntries(
            Object.entries(row).filter(([key]) =>
              !['_extras', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)
            )
          ),
          ...(row._extras as Record<string, unknown> || {}),
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      } else {
        return {
          id: row.id,
          ...(row.data as Record<string, unknown>),
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }
    });

    // Single insert returns object, bulk returns array
    return Response.json(isBulk ? formatted : formatted[0], { status: 201 });
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
 * Ensure a table exists in the registry (auto-create as JSONB)
 */
async function ensureTableExists(
  projectSql: ReturnType<typeof connectionManager.getPool> extends Promise<{ sql: infer S }> ? S : never,
  schema: string | null,
  tableName: string
): Promise<void> {
  // Try new table name first (_tables), fall back to old (tables)
  const tableRefNew = schema ? `"${schema}"."_tables"` : '"_tables"';
  const tableRefOld = schema ? `"${schema}"."tables"` : '"tables"';

  try {
    await projectSql.unsafe(
      `INSERT INTO ${tableRefNew} (name, display_name, schema, storage_mode)
       VALUES ($1, $1, '{"fields":[]}', 'jsonb')
       ON CONFLICT (name) DO NOTHING`,
      [tableName]
    );
  } catch {
    // Fall back to old table name
    await projectSql.unsafe(
      `INSERT INTO ${tableRefOld} (name, display_name, schema)
       VALUES ($1, $1, '{"fields":[]}')
       ON CONFLICT (name) DO NOTHING`,
      [tableName]
    );
  }
}

/**
 * Insert row into JSONB storage (_data table)
 */
async function insertJsonbRow(
  projectSql: ReturnType<typeof connectionManager.getPool> extends Promise<{ sql: infer S }> ? S : never,
  schema: string | null,
  tableName: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  // Try new table name first (_data), fall back to old (data)
  const tableRefNew = schema ? `"${schema}"."_data"` : '"_data"';
  const tableRefOld = schema ? `"${schema}"."data"` : '"data"';

  try {
    return await projectSql.unsafe(
      `INSERT INTO ${tableRefNew} (table_name, data)
       VALUES ($1, $2)
       RETURNING id, data, created_at, updated_at`,
      [tableName, data]
    );
  } catch {
    // Fall back to old table name
    return await projectSql.unsafe(
      `INSERT INTO ${tableRefOld} (table_name, data)
       VALUES ($1, $2)
       RETURNING id, data, created_at, updated_at`,
      [tableName, data]
    );
  }
}

/**
 * Insert row into typed table (real PostgreSQL columns)
 */
async function insertTypedRow(
  projectSql: ReturnType<typeof connectionManager.getPool> extends Promise<{ sql: infer S }> ? S : never,
  schema: string | null,
  tableName: string,
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

  // Build column names and placeholders
  const columns = Object.keys(knownData);
  const values = Object.values(knownData);

  // Add _extras if there are unknown fields
  if (Object.keys(extras).length > 0) {
    columns.push('_extras');
    values.push(JSON.stringify(extras));
  }

  if (columns.length === 0) {
    // Insert with default values only
    return await projectSql.unsafe(
      `INSERT INTO ${tableRef} DEFAULT VALUES
       RETURNING *`,
      []
    );
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const columnList = columns.map(c => `"${c}"`).join(', ');

  return await projectSql.unsafe(
    `INSERT INTO ${tableRef} (${columnList})
     VALUES (${placeholders})
     RETURNING *`,
    values
  );
}

/**
 * Bulk insert rows into JSONB storage (_data table).
 * Uses a single multi-row INSERT for atomicity and performance.
 */
async function bulkInsertJsonbRows(
  projectSql: ReturnType<typeof connectionManager.getPool> extends Promise<{ sql: infer S }> ? S : never,
  schema: string | null,
  tableName: string,
  dataRows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const tableRefNew = schema ? `"${schema}"."_data"` : '"_data"';
  const tableRefOld = schema ? `"${schema}"."data"` : '"data"';

  // Build multi-row VALUES: ($1,$2), ($1,$3), ($1,$4), ...
  // $1 is always table_name, $2..$N+1 are the JSONB data objects
  const values: unknown[] = [tableName];
  const valueClauses: string[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    values.push(dataRows[i]);
    valueClauses.push(`($1, $${i + 2})`);
  }

  const valuesStr = valueClauses.join(', ');

  try {
    return await projectSql.unsafe(
      `INSERT INTO ${tableRefNew} (table_name, data) VALUES ${valuesStr}
       RETURNING id, data, created_at, updated_at`,
      values
    );
  } catch {
    // Fall back to old table name
    return await projectSql.unsafe(
      `INSERT INTO ${tableRefOld} (table_name, data) VALUES ${valuesStr}
       RETURNING id, data, created_at, updated_at`,
      values
    );
  }
}

/**
 * Bulk insert rows into typed table (real PostgreSQL columns).
 * Unions all row columns into a single multi-row INSERT.
 * Chunks if parameter count exceeds 60000 (Postgres limit ~65535).
 */
async function bulkInsertTypedRows(
  projectSql: ReturnType<typeof connectionManager.getPool> extends Promise<{ sql: infer S }> ? S : never,
  schema: string | null,
  tableName: string,
  dataRows: Record<string, unknown>[],
  tableMeta: TableMetadata
): Promise<Record<string, unknown>[]> {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const knownFieldNames = new Set(tableMeta.schema.fields?.map(f => f.name) || []);

  // Collect the union of all columns across all rows
  const allColumnsSet = new Set<string>();
  const processedRows: { known: Record<string, unknown>; extras: Record<string, unknown> }[] = [];

  for (const row of dataRows) {
    const known: Record<string, unknown> = {};
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (knownFieldNames.has(key)) {
        known[key] = value;
        allColumnsSet.add(key);
      } else {
        extras[key] = value;
      }
    }
    if (Object.keys(extras).length > 0) {
      allColumnsSet.add('_extras');
    }
    processedRows.push({ known, extras });
  }

  const allColumns = Array.from(allColumnsSet);
  if (allColumns.length === 0) {
    // All rows are empty — insert with defaults (one at a time for DEFAULT VALUES)
    const results: Record<string, unknown>[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const res = await projectSql.unsafe(
        `INSERT INTO ${tableRef} DEFAULT VALUES RETURNING *`,
        []
      );
      results.push(...res);
    }
    return results;
  }

  const colsPerRow = allColumns.length;
  const maxParamsPerChunk = 60000;
  const rowsPerChunk = Math.floor(maxParamsPerChunk / colsPerRow);
  const chunkSize = Math.max(1, rowsPerChunk);
  const columnList = allColumns.map(c => `"${c}"`).join(', ');
  const allResults: Record<string, unknown>[] = [];

  // Process in chunks
  for (let start = 0; start < processedRows.length; start += chunkSize) {
    const chunk = processedRows.slice(start, start + chunkSize);
    const values: unknown[] = [];
    const valueClauses: string[] = [];

    for (const { known, extras } of chunk) {
      const rowPlaceholders: string[] = [];
      for (const col of allColumns) {
        if (col === '_extras') {
          const hasExtras = Object.keys(extras).length > 0;
          values.push(hasExtras ? JSON.stringify(extras) : null);
        } else {
          values.push(known[col] !== undefined ? known[col] : null);
        }
        rowPlaceholders.push(`$${values.length}`);
      }
      valueClauses.push(`(${rowPlaceholders.join(', ')})`);
    }

    const res = await projectSql.unsafe(
      `INSERT INTO ${tableRef} (${columnList}) VALUES ${valueClauses.join(', ')} RETURNING *`,
      values
    );
    allResults.push(...res);
  }

  return allResults;
}
