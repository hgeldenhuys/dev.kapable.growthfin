/**
 * Custom Fields Export Service
 * Generates CSV exports with flattened custom fields
 *
 * Story: US-CUSTOMFIELDS-004
 * Performance requirement: < 60s for 10k contacts
 */

import type { Database } from '@agios/db';
import { crmContacts, crmLeads } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import * as Papa from 'papaparse';

// ============================================================================
// TYPES
// ============================================================================

export interface ExportOptions {
  workspaceId: string;
  includeAllFields?: boolean;
  maxRows?: number;
  customFieldsOnly?: boolean;
}

export interface ExportResult {
  csv: string;
  rowCount: number;
  customFieldsDiscovered: string[];
  executionTimeMs: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert snake_case to Title Case
 * e.g., "income_bracket" -> "Income Bracket"
 */
function snakeCaseToTitleCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Escape CSV value properly for RFC 4180 compliance
 * - Wrap in quotes if contains comma, newline, or quote
 * - Double any quotes inside the value
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if value needs escaping
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Discover all unique custom field keys across a set of records
 */
function discoverCustomFieldKeys(records: any[]): string[] {
  const keySet = new Set<string>();

  for (const record of records) {
    const customFields = record.customFields as Record<string, any> || {};
    for (const key of Object.keys(customFields)) {
      keySet.add(key);
    }
  }

  // Return sorted alphabetically for consistent column order
  return Array.from(keySet).sort();
}

/**
 * Build CSV headers with proper title casing
 */
function buildCSVHeaders(standardFields: string[], customFields: string[]): string[] {
  // Standard fields use column name as-is (already properly cased in schema)
  const headers: string[] = [...standardFields];

  // Custom fields: convert snake_case to Title Case
  for (const field of customFields) {
    headers.push(snakeCaseToTitleCase(field));
  }

  return headers;
}

/**
 * Generate CSV row from record with custom fields flattened
 */
function generateCSVRow(
  record: any,
  standardFields: string[],
  customFieldKeys: string[],
  fieldMapping: Map<string, string>
): Record<string, string> {
  const row: Record<string, string> = {};

  // Add standard fields
  for (const field of standardFields) {
    let value = record[field];

    // Format arrays as comma-separated
    if (Array.isArray(value)) {
      value = value.join('; ');
    }

    // Format dates as ISO strings
    if (value instanceof Date) {
      value = value.toISOString();
    }

    // Format booleans
    if (typeof value === 'boolean') {
      value = value ? 'Yes' : 'No';
    }

    row[field] = escapeCSVValue(value ?? '');
  }

  // Add custom fields (flattened)
  const customFieldsObj = record.customFields as Record<string, any> || {};

  for (const key of customFieldKeys) {
    const value = customFieldsObj[key];
    const headerKey = fieldMapping.get(key) || snakeCaseToTitleCase(key);
    row[headerKey] = escapeCSVValue(value ?? '');
  }

  return row;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export contacts with custom fields as individual CSV columns
 */
export async function exportContactsWithCustomFields(
  db: Database,
  options: ExportOptions
): Promise<ExportResult> {
  const startTime = Date.now();

  // Fetch all contacts (respecting max limit for performance)
  const limit = options.maxRows || 10000;

  const contacts = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.workspaceId, options.workspaceId),
        isNull(crmContacts.deletedAt)
      )
    )
    .limit(limit)
    .orderBy(crmContacts.createdAt);

  if (contacts.length === 0) {
    return {
      csv: '',
      rowCount: 0,
      customFieldsDiscovered: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Discover custom fields across all contacts
  const customFieldKeys = discoverCustomFieldKeys(contacts);

  // Standard fields - in logical order
  const standardFields = [
    'id',
    'firstName',
    'lastName',
    'email',
    'phone',
    'title',
    'department',
    'status',
    'lifecycleStage',
    'leadSource',
    'tags',
  ];

  // Build header mapping (snake_case -> Title Case)
  const fieldMapping = new Map<string, string>();
  for (const key of customFieldKeys) {
    fieldMapping.set(key, snakeCaseToTitleCase(key));
  }

  // Build CSV headers
  const headers = buildCSVHeaders(standardFields, customFieldKeys);

  // Generate CSV rows
  const rows: Record<string, string>[] = [];

  for (const contact of contacts) {
    const row = generateCSVRow(contact, standardFields, customFieldKeys, fieldMapping);
    rows.push(row);
  }

  // Generate CSV using PapaParse for RFC 4180 compliance
  const csv = Papa.unparse(rows, {
    columns: headers,
    header: true,
  });

  // Add UTF-8 BOM for Excel compatibility
  const csvWithBOM = '\uFEFF' + csv;

  return {
    csv: csvWithBOM,
    rowCount: contacts.length,
    customFieldsDiscovered: customFieldKeys,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Export leads with custom fields as individual CSV columns
 */
export async function exportLeadsWithCustomFields(
  db: Database,
  options: ExportOptions
): Promise<ExportResult> {
  const startTime = Date.now();

  // Fetch all leads (respecting max limit for performance)
  const limit = options.maxRows || 10000;

  const leads = await db
    .select()
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.workspaceId, options.workspaceId),
        isNull(crmLeads.deletedAt)
      )
    )
    .limit(limit)
    .orderBy(crmLeads.createdAt);

  if (leads.length === 0) {
    return {
      csv: '',
      rowCount: 0,
      customFieldsDiscovered: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Discover custom fields across all leads
  const customFieldKeys = discoverCustomFieldKeys(leads);

  // Standard fields - in logical order (must match DB column names)
  const standardFields = [
    'id',
    'firstName',
    'lastName',
    'email',
    'phone',
    'companyName',
    'status',
    'leadScore',
    'leadSource',
    'source',
  ];

  // Build header mapping
  const fieldMapping = new Map<string, string>();
  for (const key of customFieldKeys) {
    fieldMapping.set(key, snakeCaseToTitleCase(key));
  }

  // Build CSV headers
  const headers = buildCSVHeaders(standardFields, customFieldKeys);

  // Generate CSV rows
  const rows: Record<string, string>[] = [];

  for (const lead of leads) {
    const row = generateCSVRow(lead, standardFields, customFieldKeys, fieldMapping);
    rows.push(row);
  }

  // Generate CSV using PapaParse for RFC 4180 compliance
  const csv = Papa.unparse(rows, {
    columns: headers,
    header: true,
  });

  // Add UTF-8 BOM for Excel compatibility
  const csvWithBOM = '\uFEFF' + csv;

  return {
    csv: csvWithBOM,
    rowCount: leads.length,
    customFieldsDiscovered: customFieldKeys,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate export preview: show available custom fields without exporting all data
 */
export async function getExportPreview(
  db: Database,
  workspaceId: string,
  entityType: 'contacts' | 'leads'
): Promise<{
  customFields: Array<{ name: string; displayName: string; sampleValue?: any }>;
  estimatedRecordCount: number;
}> {
  const table = entityType === 'contacts' ? crmContacts : crmLeads;

  // Get sample records to discover custom fields
  const samples = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.workspaceId, workspaceId),
        isNull(table.deletedAt)
      )
    )
    .limit(100);

  const estimatedRecordCount = samples.length;

  const customFieldKeys = discoverCustomFieldKeys(samples);

  // Build field info with sample values
  const customFields = customFieldKeys.map((key) => {
    // Find a sample value
    let sampleValue: any;
    for (const record of samples) {
      const val = (record.customFields as Record<string, any>)?.[key];
      if (val !== null && val !== undefined) {
        sampleValue = val;
        break;
      }
    }

    return {
      name: key,
      displayName: snakeCaseToTitleCase(key),
      sampleValue,
    };
  });

  return {
    customFields,
    estimatedRecordCount,
  };
}
