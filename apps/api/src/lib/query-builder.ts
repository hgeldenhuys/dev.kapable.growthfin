/**
 * Query Builder for SignalDB
 *
 * Parses filter query parameters and generates SQL for both:
 * - JSONB storage (data column)
 * - Typed tables (real PostgreSQL columns)
 *
 * Filter syntax: ?filter[field]=value or ?filter[field][op]=value
 * Operators: eq, ne, gt, gte, lt, lte, in, contains, starts, isnull
 */

import type { Sql } from 'postgres';
import type {
  FilterCondition,
  FilterOperator,
  ListQueryParams,
  TableMetadata,
  FieldDefinition,
} from '../types';

// Valid filter operators
const VALID_OPERATORS: FilterOperator[] = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'starts', 'isnull'
];

// Fields that exist as real columns (not in JSONB)
const SYSTEM_FIELDS = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'];

// Reserved query params that should NOT be treated as filters
const RESERVED_PARAMS = new Set([
  'limit', 'offset', 'order_by', 'orderBy', 'order', 'select', 'apiKey',
]);

/**
 * Parse filter query parameters from URL
 *
 * Supports:
 * - ?filter[status]=active          → { field: 'status', operator: 'eq', value: 'active' }
 * - ?filter[value][gt]=1000         → { field: 'value', operator: 'gt', value: '1000' }
 * - ?filter[status][in]=new,active  → { field: 'status', operator: 'in', value: ['new', 'active'] }
 * - ?status=active                  → { field: 'status', operator: 'eq', value: 'active' } (simple shorthand)
 */
export function parseFilters(searchParams: URLSearchParams): FilterCondition[] {
  const filters: FilterCondition[] = [];

  for (const [key, value] of searchParams.entries()) {
    // Match filter[field] or filter[field][operator]
    const match = key.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (match) {
      const field = match[1];
      const operatorOrDefault = match[2] || 'eq';

      // Validate operator
      if (!VALID_OPERATORS.includes(operatorOrDefault as FilterOperator)) {
        throw new Error(`Invalid filter operator: ${operatorOrDefault}`);
      }

      const operator = operatorOrDefault as FilterOperator;

      // Parse value based on operator
      let parsedValue: string | string[] | boolean;

      if (operator === 'in') {
        // Split comma-separated values
        parsedValue = value.split(',').map(v => v.trim());
      } else if (operator === 'isnull') {
        // Boolean value
        parsedValue = value.toLowerCase() === 'true';
      } else {
        parsedValue = value;
      }

      filters.push({ field, operator, value: parsedValue });
      continue;
    }

    // Simple query param shorthand: ?field=value → eq filter
    // Skip reserved params and filter[] params
    if (!RESERVED_PARAMS.has(key) && !key.startsWith('filter[')) {
      filters.push({ field: key, operator: 'eq', value });
    }
  }

  return filters;
}

/**
 * Parse all query parameters for list operations
 */
export function parseListParams(searchParams: URLSearchParams): ListQueryParams {
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(searchParams.get('offset') || '0');
  const orderBy = searchParams.get('orderBy') || 'created_at';
  const order = searchParams.get('order')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const filters = parseFilters(searchParams);

  return { limit, offset, orderBy, order, filters };
}

/**
 * Build SQL WHERE clause for JSONB storage
 *
 * Generates conditions like:
 * - data->>'status' = 'active'
 * - (data->>'value')::numeric > 1000
 */
export function buildJsonbWhereClause(
  sql: Sql,
  filters: FilterCondition[],
  tableMeta?: TableMetadata
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const filter of filters) {
    const { field, operator, value } = filter;

    // System fields are real columns, not in JSONB
    const isSystemField = SYSTEM_FIELDS.includes(field);

    // Determine field type from schema if available
    let fieldType: FieldDefinition['type'] = 'text';
    if (tableMeta?.schema?.fields) {
      const fieldDef = tableMeta.schema.fields.find(f => f.name === field);
      if (fieldDef) fieldType = fieldDef.type;
    }

    // Build the field accessor
    let fieldAccessor: string;
    if (isSystemField) {
      fieldAccessor = `"${field}"`;
    } else {
      // Cast JSONB extraction based on field type
      switch (fieldType) {
        case 'number':
          fieldAccessor = `(data->>'${field}')::numeric`;
          break;
        case 'boolean':
          fieldAccessor = `(data->>'${field}')::boolean`;
          break;
        case 'date':
          fieldAccessor = `(data->>'${field}')::timestamptz`;
          break;
        default:
          fieldAccessor = `data->>'${field}'`;
      }
    }

    // Build condition based on operator
    switch (operator) {
      case 'eq':
        conditions.push(`${fieldAccessor} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'ne':
        conditions.push(`${fieldAccessor} != $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'gt':
        conditions.push(`${fieldAccessor} > $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'gte':
        conditions.push(`${fieldAccessor} >= $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'lt':
        conditions.push(`${fieldAccessor} < $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'lte':
        conditions.push(`${fieldAccessor} <= $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'in':
        if (Array.isArray(value)) {
          const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
          conditions.push(`${fieldAccessor} IN (${placeholders})`);
          values.push(...value);
          paramIndex += value.length;
        }
        break;

      case 'contains':
        // Case-insensitive contains using ILIKE
        conditions.push(`${isSystemField ? fieldAccessor : `data->>'${field}'`} ILIKE $${paramIndex}`);
        values.push(`%${value}%`);
        paramIndex++;
        break;

      case 'starts':
        // Case-insensitive starts with
        conditions.push(`${isSystemField ? fieldAccessor : `data->>'${field}'`} ILIKE $${paramIndex}`);
        values.push(`${value}%`);
        paramIndex++;
        break;

      case 'isnull':
        if (value === true) {
          if (isSystemField) {
            conditions.push(`${fieldAccessor} IS NULL`);
          } else {
            conditions.push(`(data->>'${field}' IS NULL OR data->>'${field}' = '')`);
          }
        } else {
          if (isSystemField) {
            conditions.push(`${fieldAccessor} IS NOT NULL`);
          } else {
            conditions.push(`(data->>'${field}' IS NOT NULL AND data->>'${field}' != '')`);
          }
        }
        break;
    }
  }

  return { conditions, values };
}

/**
 * Build SQL WHERE clause for typed tables
 *
 * Generates conditions using real column names
 */
export function buildTypedWhereClause(
  sql: Sql,
  filters: FilterCondition[],
  tableMeta: TableMetadata
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Get known field names from schema
  const knownFields = new Set([
    ...SYSTEM_FIELDS,
    ...(tableMeta.schema.fields?.map(f => f.name) || []),
  ]);

  for (const filter of filters) {
    const { field, operator, value } = filter;

    // Check if field exists as a column
    const isKnownField = knownFields.has(field);

    // Build field accessor - if unknown field, check _extras JSONB column
    let fieldAccessor: string;
    if (isKnownField) {
      fieldAccessor = `"${field}"`;
    } else {
      // Field might be in _extras JSONB column
      fieldAccessor = `_extras->>'${field}'`;
    }

    // Build condition based on operator
    switch (operator) {
      case 'eq':
        conditions.push(`${fieldAccessor} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'ne':
        conditions.push(`${fieldAccessor} != $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'gt':
        conditions.push(`${fieldAccessor} > $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'gte':
        conditions.push(`${fieldAccessor} >= $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'lt':
        conditions.push(`${fieldAccessor} < $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'lte':
        conditions.push(`${fieldAccessor} <= $${paramIndex}`);
        values.push(value);
        paramIndex++;
        break;

      case 'in':
        if (Array.isArray(value)) {
          const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
          conditions.push(`${fieldAccessor} IN (${placeholders})`);
          values.push(...value);
          paramIndex += value.length;
        }
        break;

      case 'contains':
        conditions.push(`${fieldAccessor} ILIKE $${paramIndex}`);
        values.push(`%${value}%`);
        paramIndex++;
        break;

      case 'starts':
        conditions.push(`${fieldAccessor} ILIKE $${paramIndex}`);
        values.push(`${value}%`);
        paramIndex++;
        break;

      case 'isnull':
        if (value === true) {
          conditions.push(`${fieldAccessor} IS NULL`);
        } else {
          conditions.push(`${fieldAccessor} IS NOT NULL`);
        }
        break;
    }
  }

  return { conditions, values };
}

/**
 * Validate order by field to prevent SQL injection
 */
export function validateOrderByField(
  orderBy: string,
  tableMeta?: TableMetadata
): boolean {
  // Always allow system fields
  if (SYSTEM_FIELDS.includes(orderBy)) {
    return true;
  }

  // If no schema, only allow system fields
  if (!tableMeta?.schema?.fields) {
    return false;
  }

  // Check if field exists in schema
  return tableMeta.schema.fields.some(f => f.name === orderBy);
}

/**
 * Build complete list query for JSONB storage
 *
 * Returns the complete SQL query string and values array
 */
export function buildJsonbListQuery(
  schema: string | null,
  tableName: string,
  params: ListQueryParams,
  tableMeta?: TableMetadata
): { query: string; countQuery: string; values: unknown[] } {
  const { conditions, values } = buildJsonbWhereClause(
    null as unknown as Sql, // We're building raw SQL strings
    params.filters,
    tableMeta
  );

  // Build table reference
  const tableRef = schema ? `"${schema}"."_data"` : '"_data"';

  // Start with base condition
  const allConditions = [`table_name = $${values.length + 1}`];
  const allValues = [...values, tableName];

  // Add filter conditions (indices are already correct — filter values occupy
  // $1..$N in allValues, and table_name sits at $N+1)
  allConditions.push(...conditions);

  const whereClause = allConditions.length > 0
    ? `WHERE ${allConditions.join(' AND ')}`
    : '';

  // Validate orderBy field
  const safeOrderBy = validateOrderByField(params.orderBy, tableMeta)
    ? params.orderBy
    : 'created_at';

  // For JSONB, ordering by data fields requires JSONB extraction
  let orderByClause: string;
  if (SYSTEM_FIELDS.includes(safeOrderBy)) {
    orderByClause = `"${safeOrderBy}"`;
  } else {
    orderByClause = `data->>'${safeOrderBy}'`;
  }

  const query = `
    SELECT id, data, created_at, updated_at
    FROM ${tableRef}
    ${whereClause}
    ORDER BY ${orderByClause} ${params.order}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `.trim();

  const countQuery = `
    SELECT COUNT(*) as count
    FROM ${tableRef}
    ${whereClause}
  `.trim();

  return { query, countQuery, values: allValues };
}

/**
 * Build complete list query for typed tables
 */
export function buildTypedListQuery(
  schema: string | null,
  tableName: string,
  params: ListQueryParams,
  tableMeta: TableMetadata
): { query: string; countQuery: string; values: unknown[] } {
  const { conditions, values } = buildTypedWhereClause(
    null as unknown as Sql,
    params.filters,
    tableMeta
  );

  // Build table reference (typed tables use the actual table name)
  const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Validate orderBy field
  const safeOrderBy = validateOrderByField(params.orderBy, tableMeta)
    ? params.orderBy
    : 'created_at';

  const query = `
    SELECT *
    FROM ${tableRef}
    ${whereClause}
    ORDER BY "${safeOrderBy}" ${params.order}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `.trim();

  const countQuery = `
    SELECT COUNT(*) as count
    FROM ${tableRef}
    ${whereClause}
  `.trim();

  return { query, countQuery, values };
}

/**
 * Get table metadata from registry
 */
export async function getTableMetadata(
  projectSql: Sql,
  schema: string | null,
  tableName: string
): Promise<TableMetadata | null> {
  const tableRef = schema ? `"${schema}"."_tables"` : '"_tables"';

  try {
    // Use unsafe query since we're using dynamic table names
    const result = await projectSql.unsafe(
      `SELECT id, name, display_name, schema, settings,
              COALESCE(storage_mode, 'jsonb') as storage_mode,
              rsc_schema, rsc_source,
              created_at, updated_at
       FROM ${tableRef}
       WHERE name = $1
       LIMIT 1`,
      [tableName]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      schema: row.schema || { fields: [] },
      settings: row.settings || {},
      storage_mode: row.storage_mode || 'jsonb',
      rsc_schema: row.rsc_schema || null,
      rsc_source: row.rsc_source || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (error) {
    // Table might not exist yet (using old 'tables' name)
    // Fall back to old table name during migration period
    try {
      const fallbackTableRef = schema ? `"${schema}"."tables"` : '"tables"';
      const result = await projectSql.unsafe(
        `SELECT id, name, display_name, schema, settings,
                'jsonb' as storage_mode,
                created_at, updated_at
         FROM ${fallbackTableRef}
         WHERE name = $1
         LIMIT 1`,
        [tableName]
      );

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        name: row.name,
        display_name: row.display_name,
        schema: row.schema || { fields: [] },
        settings: row.settings || {},
        storage_mode: 'jsonb',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Check if a table exists in the registry
 */
export async function tableExists(
  projectSql: Sql,
  schema: string | null,
  tableName: string
): Promise<boolean> {
  const meta = await getTableMetadata(projectSql, schema, tableName);
  return meta !== null;
}
