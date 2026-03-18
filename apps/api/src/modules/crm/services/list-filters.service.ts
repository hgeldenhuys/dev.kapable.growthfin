/**
 * List Filters Service
 * Custom field filtering for polymorphic list members
 */

import type { Database } from '@agios/db';
import { and, eq, sql, isNull, SQL } from 'drizzle-orm';
import * as schema from '@agios/db/schema';
import type { CrmEntityType } from '@agios/db/schema/contact-lists';

/**
 * Parse custom field filter query params
 * Supports operators: exact, min, max, contains
 *
 * Examples:
 * - customField.ethnicity=african → exact match
 * - customField.confidence.min=0.8 → >= 0.8
 * - customField.confidence.max=1.0 → <= 1.0
 * - customField.name.contains=John → LIKE '%John%'
 */
export interface CustomFieldFilter {
  field: string;
  operator: 'exact' | 'min' | 'max' | 'contains';
  value: string | number;
}

export function parseCustomFieldFilters(queryParams: Record<string, string>): CustomFieldFilter[] {
  const filters: CustomFieldFilter[] = [];

  for (const [key, value] of Object.entries(queryParams)) {
    if (!key.startsWith('customField.')) continue;

    const parts = key.replace('customField.', '').split('.');

    if (parts.length === 1) {
      // Exact match: customField.ethnicity=african
      filters.push({
        field: parts[0],
        operator: 'exact',
        value,
      });
    } else if (parts.length === 2) {
      // Operator: customField.confidence.min=0.8
      const [field, operator] = parts;
      if (['min', 'max', 'contains'].includes(operator)) {
        filters.push({
          field,
          operator: operator as 'min' | 'max' | 'contains',
          value: operator === 'contains' ? value : parseFloat(value),
        });
      }
    }
  }

  return filters;
}

/**
 * Build SQL conditions for custom field filters on entity table
 */
export function buildCustomFieldConditions(
  entityTable: typeof schema.crmContacts | typeof schema.crmLeads | typeof schema.crmAccounts | typeof schema.crmOpportunities,
  filters: CustomFieldFilter[]
): SQL[] {
  const conditions: SQL[] = [];

  for (const filter of filters) {
    switch (filter.operator) {
      case 'exact':
        // JSONB ->> operator for text extraction
        conditions.push(
          sql`(${entityTable.customFields}->>${filter.field}) = ${filter.value}`
        );
        break;

      case 'min':
        // Cast to numeric and compare
        conditions.push(
          sql`(${entityTable.customFields}->>${filter.field})::numeric >= ${filter.value}`
        );
        break;

      case 'max':
        // Cast to numeric and compare
        conditions.push(
          sql`(${entityTable.customFields}->>${filter.field})::numeric <= ${filter.value}`
        );
        break;

      case 'contains':
        // Case-insensitive LIKE
        conditions.push(
          sql`LOWER(${entityTable.customFields}->>${filter.field}) LIKE LOWER(${'%' + filter.value + '%'})`
        );
        break;
    }
  }

  return conditions;
}

/**
 * Get distinct values for a custom field (for filter dropdowns)
 */
export async function getFilterOptions(
  db: Database,
  listId: string,
  workspaceId: string,
  fieldName: string
): Promise<{ value: string; count: number }[]> {
  // First, get the list to determine entity type
  const list = await db
    .select()
    .from(schema.crmContactLists)
    .where(
      and(
        eq(schema.crmContactLists.id, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId),
        isNull(schema.crmContactLists.deletedAt)
      )
    )
    .limit(1);

  if (!list[0]) {
    throw new Error('List not found');
  }

  const entityType = list[0].entityType;

  // Sanitize field name to prevent SQL injection
  const sanitizedFieldName = fieldName.replace(/[^a-zA-Z0-9_]/g, '');

  // Build entity-type-specific query
  let entityTable: string;
  let entityAlias: string;

  switch (entityType) {
    case 'contact':
      entityTable = 'crm_contacts';
      entityAlias = 'c';
      break;
    case 'lead':
      entityTable = 'crm_leads';
      entityAlias = 'l';
      break;
    case 'account':
      entityTable = 'crm_accounts';
      entityAlias = 'a';
      break;
    case 'opportunity':
      entityTable = 'crm_opportunities';
      entityAlias = 'o';
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  // Query for distinct values with counts
  // This joins memberships with the specific entity table for this list's type
  const result = await db.execute(sql.raw(`
    SELECT
      (${entityAlias}.custom_fields->>'${sanitizedFieldName}') as value,
      COUNT(*) as count
    FROM crm_contact_list_memberships m
    INNER JOIN ${entityTable} ${entityAlias}
      ON m.entity_id = ${entityAlias}.id
      AND ${entityAlias}.deleted_at IS NULL
    WHERE
      m.list_id = '${listId}'
      AND m.entity_type = '${entityType}'
      AND m.deleted_at IS NULL
      AND m.is_active = true
      AND (${entityAlias}.custom_fields->>'${sanitizedFieldName}') IS NOT NULL
    GROUP BY value
    ORDER BY count DESC, value
    LIMIT 100
  `));

  // Handle both array and object with rows property
  const rows = Array.isArray(result) ? result : (result.rows || []);
  return rows.map((row: any) => ({
    value: row.value,
    count: parseInt(row.count, 10),
  }));
}

/**
 * Helper to get entity table reference by type
 */
function getEntityTable(entityType: CrmEntityType) {
  switch (entityType) {
    case 'contact':
      return schema.crmContacts;
    case 'lead':
      return schema.crmLeads;
    case 'account':
      return schema.crmAccounts;
    case 'opportunity':
      return schema.crmOpportunities;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export const listFiltersService = {
  parseCustomFieldFilters,
  buildCustomFieldConditions,
  getFilterOptions,
  getEntityTable,
};
