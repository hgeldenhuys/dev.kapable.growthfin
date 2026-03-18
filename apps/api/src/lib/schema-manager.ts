/**
 * Schema Manager for SignalDB
 *
 * Handles DDL generation and typed table management:
 * - Creating typed tables from schema definitions
 * - Schema evolution (adding/removing columns)
 * - Migrating between storage modes (jsonb <-> typed)
 * - NOTIFY triggers for typed tables
 */

import type { Sql } from 'postgres';
import type { FieldDefinition, TableSchema, TableMetadata, TableSettings } from '../types';
import { TYPE_MAP } from '../types';

// Reserved table names (system tables)
const RESERVED_NAMES = new Set(['_tables', '_data', '_migrations', '_audit']);

// Reserved column names (system columns in typed tables)
const RESERVED_COLUMNS = new Set([
  'id', '_extras', 'created_at', 'updated_at', 'created_by', 'updated_by'
]);

/**
 * Validate table name is safe to use
 */
export function validateTableName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Table name is required' };
  }

  if (RESERVED_NAMES.has(name.toLowerCase())) {
    return { valid: false, error: `Table name '${name}' is reserved` };
  }

  // Must start with letter, contain only letters/numbers/underscores
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: 'Table name must start with a letter and contain only letters, numbers, and underscores' };
  }

  // Max length 63 (PostgreSQL identifier limit)
  if (name.length > 63) {
    return { valid: false, error: 'Table name must be 63 characters or less' };
  }

  return { valid: true };
}

/**
 * Validate field name is safe to use
 */
export function validateFieldName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Field name is required' };
  }

  if (RESERVED_COLUMNS.has(name.toLowerCase())) {
    return { valid: false, error: `Field name '${name}' is reserved` };
  }

  // Must start with letter, contain only letters/numbers/underscores
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: 'Field name must start with a letter and contain only letters, numbers, and underscores' };
  }

  if (name.length > 63) {
    return { valid: false, error: 'Field name must be 63 characters or less' };
  }

  return { valid: true };
}

/**
 * Generate column definition SQL for a field
 */
function generateColumnDef(field: FieldDefinition): string {
  const pgType = TYPE_MAP[field.type] || 'TEXT';
  const parts: string[] = [`"${field.name}" ${pgType}`];

  // NOT NULL constraint
  if (field.required) {
    parts.push('NOT NULL');
  }

  // Default value
  if (field.default !== undefined) {
    if (field.type === 'text' || field.type === 'select') {
      parts.push(`DEFAULT '${String(field.default).replace(/'/g, "''")}'`);
    } else if (field.type === 'boolean') {
      parts.push(`DEFAULT ${field.default ? 'TRUE' : 'FALSE'}`);
    } else if (field.type === 'number') {
      parts.push(`DEFAULT ${Number(field.default)}`);
    } else if (field.type === 'json') {
      parts.push(`DEFAULT '${JSON.stringify(field.default)}'::jsonb`);
    }
    // date defaults are handled by PostgreSQL
  }

  return parts.join(' ');
}

/**
 * Generate CREATE TABLE DDL for a typed table
 */
export function generateCreateTableDDL(
  schema: string | null,
  tableName: string,
  tableSchema: TableSchema
): string {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;

  const columnDefs: string[] = [
    // Primary key
    'id UUID PRIMARY KEY DEFAULT uuid_generate_v4()',
  ];

  // User-defined columns
  for (const field of tableSchema.fields || []) {
    const validation = validateFieldName(field.name);
    if (!validation.valid) {
      throw new Error(`Invalid field: ${validation.error}`);
    }
    columnDefs.push(generateColumnDef(field));
  }

  // System columns
  columnDefs.push(
    '_extras JSONB DEFAULT \'{}\'::jsonb',  // For untyped fields
    'created_at TIMESTAMPTZ DEFAULT NOW()',
    'updated_at TIMESTAMPTZ DEFAULT NOW()',
    'created_by UUID',
    'updated_by UUID'
  );

  return `CREATE TABLE ${tableRef} (\n  ${columnDefs.join(',\n  ')}\n)`;
}

/**
 * Generate index DDL for a typed table
 */
export function generateIndexDDL(
  schema: string | null,
  tableName: string,
  tableSchema: TableSchema
): string[] {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const indexPrefix = schema ? `"${schema}".` : '';

  const statements: string[] = [
    // Always index created_at for ordering
    `CREATE INDEX IF NOT EXISTS "idx_${tableName}_created_at" ON ${tableRef}(created_at DESC)`,
    // GIN index on _extras for JSON queries
    `CREATE INDEX IF NOT EXISTS "idx_${tableName}_extras" ON ${tableRef} USING GIN(_extras)`,
  ];

  // Add indexes for commonly filtered fields (select fields are good candidates)
  for (const field of tableSchema.fields || []) {
    if (field.type === 'select' || field.required) {
      statements.push(
        `CREATE INDEX IF NOT EXISTS "idx_${tableName}_${field.name}" ON ${tableRef}("${field.name}")`
      );
    }
  }

  return statements;
}

/**
 * Generate NOTIFY trigger DDL for a typed table
 */
export function generateNotifyTriggerDDL(
  schema: string | null,
  tableName: string,
  projectId: string
): string[] {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const functionRef = schema ? `"${schema}"."notify_${tableName}_change"` : `"notify_${tableName}_change"`;
  const channel = `project_${projectId.replace(/-/g, '_')}`;

  return [
    // Create the trigger function
    `CREATE OR REPLACE FUNCTION ${functionRef}()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  record_data RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    record_data := OLD;
  ELSE
    record_data := NEW;
  END IF;

  payload := jsonb_build_object(
    'op', TG_OP,
    'table', '${tableName}',
    'id', record_data.id,
    'data', row_to_json(record_data)::jsonb,
    'ts', extract(epoch from now())
  );

  PERFORM pg_notify('${channel}', payload::TEXT);
  RETURN record_data;
END;
$$ LANGUAGE plpgsql`,

    // Create the trigger
    `DROP TRIGGER IF EXISTS "${tableName}_notify" ON ${tableRef}`,
    `CREATE TRIGGER "${tableName}_notify"
  AFTER INSERT OR UPDATE OR DELETE ON ${tableRef}
  FOR EACH ROW EXECUTE FUNCTION ${functionRef}()`,
  ];
}

/**
 * Generate updated_at trigger DDL for a typed table
 */
export function generateUpdatedAtTriggerDDL(
  schema: string | null,
  tableName: string
): string[] {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const functionRef = schema ? `"${schema}"."update_updated_at"` : '"update_updated_at"';

  return [
    `DROP TRIGGER IF EXISTS "${tableName}_updated_at" ON ${tableRef}`,
    `CREATE TRIGGER "${tableName}_updated_at"
  BEFORE UPDATE ON ${tableRef}
  FOR EACH ROW EXECUTE FUNCTION ${functionRef}()`,
  ];
}

/**
 * Create a typed table with all necessary DDL
 */
export async function createTypedTable(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  tableSchema: TableSchema,
  projectId: string
): Promise<void> {
  // Validate table name
  const validation = validateTableName(tableName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate and execute DDL
  const createTableDDL = generateCreateTableDDL(schema, tableName, tableSchema);
  await projectSql.unsafe(createTableDDL);

  // Create indexes
  const indexDDL = generateIndexDDL(schema, tableName, tableSchema);
  for (const ddl of indexDDL) {
    await projectSql.unsafe(ddl);
  }

  // Create NOTIFY trigger
  const notifyDDL = generateNotifyTriggerDDL(schema, tableName, projectId);
  for (const ddl of notifyDDL) {
    await projectSql.unsafe(ddl);
  }

  // Create updated_at trigger
  const updatedAtDDL = generateUpdatedAtTriggerDDL(schema, tableName);
  for (const ddl of updatedAtDDL) {
    await projectSql.unsafe(ddl);
  }
}

/**
 * Drop a typed table
 */
export async function dropTypedTable(
  projectSql: Sql,
  schema: string | null,
  tableName: string
): Promise<void> {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  await projectSql.unsafe(`DROP TABLE IF EXISTS ${tableRef} CASCADE`);
}

/**
 * Add a column to a typed table
 */
export async function addColumn(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  field: FieldDefinition
): Promise<void> {
  const validation = validateFieldName(field.name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const columnDef = generateColumnDef(field);

  await projectSql.unsafe(`ALTER TABLE ${tableRef} ADD COLUMN ${columnDef}`);

  // Migrate data from _extras if present
  await projectSql.unsafe(`
    UPDATE ${tableRef}
    SET "${field.name}" = (_extras->>'${field.name}')${field.type === 'number' ? '::numeric' : field.type === 'boolean' ? '::boolean' : ''},
        _extras = _extras - '${field.name}'
    WHERE _extras ? '${field.name}'
  `);

  // Add index if it's a select field or required
  if (field.type === 'select' || field.required) {
    await projectSql.unsafe(
      `CREATE INDEX IF NOT EXISTS "idx_${tableName}_${field.name}" ON ${tableRef}("${field.name}")`
    );
  }
}

/**
 * Remove a column from a typed table (preserves data in _extras)
 */
export async function removeColumn(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  fieldName: string
): Promise<void> {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;

  // Preserve data in _extras before dropping
  await projectSql.unsafe(`
    UPDATE ${tableRef}
    SET _extras = _extras || jsonb_build_object('${fieldName}', "${fieldName}")
    WHERE "${fieldName}" IS NOT NULL
  `);

  // Drop the column
  await projectSql.unsafe(`ALTER TABLE ${tableRef} DROP COLUMN IF EXISTS "${fieldName}"`);
}

/**
 * Migrate table from JSONB storage to typed table.
 *
 * Uses a single INSERT INTO ... SELECT to move all rows from _data
 * into the new typed table, avoiding per-row INSERT (N+1 pattern).
 */
export async function migrateToTyped(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  tableSchema: TableSchema,
  projectId: string
): Promise<{ migrated: number }> {
  const dataTableRef = schema ? `"${schema}"."_data"` : '"_data"';

  // Create the typed table
  await createTypedTable(projectSql, schema, tableName, tableSchema, projectId);

  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;

  const fields = tableSchema.fields || [];

  // Build the column list and SELECT expressions for a single INSERT...SELECT
  const insertColumns: string[] = ['id'];
  const selectExprs: string[] = ['id'];

  for (const field of fields) {
    const pgType = TYPE_MAP[field.type] || 'TEXT';
    insertColumns.push(`"${field.name}"`);
    if (field.type === 'json') {
      // JSON fields: use -> to keep as JSONB (not ->> which returns text)
      selectExprs.push(`(data->'${field.name}')::${pgType}`);
    } else {
      // All other types: extract as text via ->> then cast
      selectExprs.push(`(data->>'${field.name}')::${pgType}`);
    }
  }

  // _extras: remove all known field keys from data JSONB
  insertColumns.push('_extras');
  if (fields.length > 0) {
    const fieldNamesArray = fields.map(f => `'${f.name}'`).join(', ');
    selectExprs.push(`COALESCE(data - ARRAY[${fieldNamesArray}]::text[], '{}'::jsonb)`);
  } else {
    // No known fields -- everything is extras
    selectExprs.push(`COALESCE(data, '{}'::jsonb)`);
  }

  // System columns carried over directly
  insertColumns.push('created_at', 'updated_at', 'created_by', 'updated_by');
  selectExprs.push('created_at', 'updated_at', 'created_by', 'updated_by');

  const insertColumnList = insertColumns.map(c => c.startsWith('"') ? c : `"${c}"`).join(', ');
  const selectExprList = selectExprs.join(', ');

  // Single bulk INSERT...SELECT migrates all rows at once
  const result = await projectSql.unsafe(
    `INSERT INTO ${tableRef} (${insertColumnList})
     SELECT ${selectExprList}
     FROM ${dataTableRef}
     WHERE table_name = $1`,
    [tableName]
  );

  const migrated = result.count ?? 0;

  // Delete migrated rows from _data
  await projectSql.unsafe(
    `DELETE FROM ${dataTableRef} WHERE table_name = $1`,
    [tableName]
  );

  return { migrated };
}

/**
 * Migrate table from typed back to JSONB storage.
 *
 * Uses a single INSERT INTO ... SELECT to move all rows from the
 * typed table into _data, avoiding per-row INSERT (N+1 pattern).
 */
export async function migrateToJsonb(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  tableSchema: TableSchema
): Promise<{ migrated: number }> {
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const dataTableRef = schema ? `"${schema}"."_data"` : '"_data"';

  const fields = tableSchema.fields || [];

  // Build a JSONB object from the typed columns, then merge _extras.
  // We use jsonb_strip_nulls to omit NULL fields (matching original behavior).
  let dataExpr: string;
  if (fields.length > 0) {
    const fieldPairs = fields
      .map(f => `'${f.name}', to_jsonb("${f.name}")`)
      .join(', ');
    dataExpr = `jsonb_strip_nulls(jsonb_build_object(${fieldPairs})) || COALESCE(_extras, '{}'::jsonb)`;
  } else {
    // No known fields -- only _extras
    dataExpr = `COALESCE(_extras, '{}'::jsonb)`;
  }

  // Single bulk INSERT...SELECT migrates all rows at once
  const result = await projectSql.unsafe(
    `INSERT INTO ${dataTableRef} (id, table_name, data, created_at, updated_at, created_by, updated_by)
     SELECT
       id,
       $1,
       ${dataExpr},
       created_at, updated_at, created_by, updated_by
     FROM ${tableRef}`,
    [tableName]
  );

  const migrated = result.count ?? 0;

  // Drop the typed table
  await dropTypedTable(projectSql, schema, tableName);

  return { migrated };
}

/**
 * Update table registry with new storage mode
 */
export async function updateTableStorageMode(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  storageMode: 'jsonb' | 'typed'
): Promise<void> {
  const tableRef = schema ? `"${schema}"."_tables"` : '"_tables"';

  await projectSql.unsafe(
    `UPDATE ${tableRef} SET storage_mode = $1, updated_at = NOW() WHERE name = $2`,
    [storageMode, tableName]
  );
}

/**
 * Create or update table in registry
 */
export async function upsertTableRegistry(
  projectSql: Sql,
  schema: string | null,
  tableName: string,
  displayName: string | null,
  tableSchema: TableSchema,
  settings: TableSettings
): Promise<void> {
  const tableRef = schema ? `"${schema}"."_tables"` : '"_tables"';
  const storageMode = settings.storage_mode || 'jsonb';

  try {
    // Try new table name first
    await projectSql.unsafe(
      `INSERT INTO ${tableRef} (name, display_name, schema, settings, storage_mode)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         schema = EXCLUDED.schema,
         settings = EXCLUDED.settings,
         storage_mode = EXCLUDED.storage_mode,
         updated_at = NOW()`,
      [tableName, displayName || tableName, JSON.stringify(tableSchema), JSON.stringify(settings), storageMode]
    );
  } catch {
    // Fall back to old table name
    const fallbackRef = schema ? `"${schema}"."tables"` : '"tables"';
    await projectSql.unsafe(
      `INSERT INTO ${fallbackRef} (name, display_name, schema, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         schema = EXCLUDED.schema,
         settings = EXCLUDED.settings,
         updated_at = NOW()`,
      [tableName, displayName || tableName, JSON.stringify(tableSchema), JSON.stringify(settings)]
    );
  }
}
