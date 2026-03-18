/**
 * Leads Import Service (Test-Friendly)
 * Business logic for importing leads from CSV with custom field detection
 * Designed for both production file uploads and test automation
 */

import type { Database } from '@agios/db';
import { crmLeadImports, type NewCrmLeadImport, type CrmLeadImport } from '@agios/db';
import { eq, and } from 'drizzle-orm';
import { parseCSV, validateRow, type ValidationSchema, type ValidationError } from '../../../lib/csv-utils';
import { customFieldsService } from '../../../services/custom-fields-service';
import { typeInferenceService } from './type-inference.service';
import { leadService } from './leads';
import { listsService } from './lists.service';
import { listMembersService } from './list-members.service';
import { timelineService } from './timeline';

/**
 * Import result interface
 */
export interface LeadImportResult {
  listId: string;
  leadsImported: number;
  listName: string;
  failed: number;
  errors: ValidationError[];
  customFieldsDetected: string[];
  customFieldSchema: Record<string, any>;
}

/**
 * Normalize phone number by adding prefix if needed
 * @param phone - The raw phone number from CSV
 * @param prefix - The prefix to add (e.g., "+27")
 * @returns Normalized phone number with prefix if applicable
 */
function normalizePhoneNumber(phone: string | null | undefined, prefix?: string): string | undefined {
  if (!phone) return undefined;

  const phoneStr = String(phone).trim();
  if (!phoneStr) return undefined;

  // If no prefix provided, return as-is
  if (!prefix) return phoneStr;

  // If phone already starts with "+", don't add prefix
  if (phoneStr.startsWith('+')) return phoneStr;

  // If phone already starts with the country code digits (without "+"), just prepend "+"
  const prefixDigits = prefix.replace('+', '');
  if (phoneStr.startsWith(prefixDigits)) return `+${phoneStr}`;

  // Add the prefix
  return `${prefix}${phoneStr}`;
}

/**
 * Import parameters
 */
export interface LeadImportParams {
  csvContent: string;
  workspaceId: string;
  userId: string;
  filename?: string;
  mapping?: Record<string, string>;
  customFieldMappings?: Record<string, string>;
  mergeStrategy?: 'merge' | 'replace';
  validationMode?: 'strict' | 'lenient';
  duplicateStrategy?: 'skip' | 'update' | 'create';
  phonePrefix?: string;
}

/**
 * Standard lead field names (not treated as custom fields)
 * US-CRM-ADDR-002: Added address fields
 * Includes both camelCase (CSV column names) and snake_case (database field names after mapping)
 */
const STANDARD_FIELDS = new Set([
  // CamelCase (CSV column names)
  'firstName',
  'lastName',
  'companyName',
  'email',
  'phone',
  'mobile',
  'source',
  'status',
  'leadScore',
  'estimatedValue',
  'expectedCloseDate',
  'tags',
  'ownerId',
  'addressLine1',
  'addressLine2',
  'city',
  'stateProvince',
  'postalCode',
  'country',
  // Common aliases (mapped from CSV columns)
  'company',
  'address',
  'state',
  // Snake_case (database field names after mapping)
  'first_name',
  'last_name',
  'company_name',
  'lead_score',
  'estimated_value',
  'expected_close_date',
  'owner_id',
  'address_line1',
  'address_line2',
  'state_province',
  'postal_code',
]);

/**
 * Test-friendly import method - accepts CSV string directly
 * Use this in automated tests to avoid file upload complexity
 *
 * @example
 * ```typescript
 * const result = await importLeadsFromCSVString({
 *   csvContent: readFileSync('test-leads.csv', 'utf-8'),
 *   workspaceId: 'test-workspace-id',
 *   userId: 'test-user-id',
 *   filename: 'test-leads.csv',
 * });
 * ```
 */
export async function importLeadsFromCSVString(
  db: Database,
  params: LeadImportParams,
  onProgress?: (processed: number, imported: number, failed: number) => void | Promise<void>
): Promise<LeadImportResult> {
  const {
    csvContent,
    workspaceId,
    userId,
    filename = 'import',
    mapping,
    customFieldMappings = {},
    mergeStrategy = 'merge',
    validationMode = 'lenient',
    duplicateStrategy = 'skip',
    phonePrefix,
  } = params;

  // Parse CSV with optional mapping
  console.log('========================================');
  console.log('[DEBUG] CSV IMPORT START');
  console.log('[DEBUG] Workspace:', workspaceId);
  console.log('[DEBUG] User:', userId);
  console.log('[DEBUG] Filename:', filename);
  console.log('[DEBUG] Column mapping:', JSON.stringify(mapping, null, 2));
  console.log('[DEBUG] Custom field mappings:', JSON.stringify(customFieldMappings, null, 2));
  console.log('[DEBUG] Merge strategy:', mergeStrategy);
  console.log('========================================');

  const parseResult = parseCSV(csvContent, mapping);

  console.log('[DEBUG] Parse result - rows:', parseResult.data.length, 'errors:', parseResult.errors.length);
  if (parseResult.data.length > 0) {
    console.log('[DEBUG] First row after column mapping:', JSON.stringify(parseResult.data[0], null, 2));
  }
  if (parseResult.data.length > 1) {
    console.log('[DEBUG] Second row after column mapping:', JSON.stringify(parseResult.data[1], null, 2));
  }

  if (parseResult.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parseResult.errors.map(e => e.message).join(', ')}`);
  }

  // Define validation schema for leads
  // Note: source is not required because we default it to 'import' if missing
  // email and phone are NOT required fields - only validate format if present
  const validationSchema: ValidationSchema = {
    email: ['email'],
    phone: ['phone'],
    enum: {
      status: ['new', 'contacted', 'qualified', 'unqualified', 'converted'],
    },
    date: ['expectedCloseDate'],
    number: ['leadScore', 'estimatedValue'],
  };

  console.log('[DEBUG] Validation Schema being used:', {
    hasRequired: !!validationSchema.required,
    required: validationSchema.required || 'NONE',
    email: validationSchema.email,
    validationMode,
    message: 'Email is NOT in required array - only format validation if present!'
  });

  // Detect custom columns (columns not in standard fields)
  const allColumns = parseResult.data.length > 0 ? Object.keys(parseResult.data[0] || {}) : [];
  const customColumns = allColumns.filter((col) => !STANDARD_FIELDS.has(col));

  console.log('[DEBUG] Column detection:');
  console.log('  - All columns in CSV:', allColumns);
  console.log('  - Standard fields (will skip):', Array.from(STANDARD_FIELDS).filter(f => allColumns.includes(f)));
  console.log('  - Custom columns detected:', customColumns);

  // Infer schema for custom columns with mappings
  const customFieldSchema =
    customColumns.length > 0 && parseResult.data.length > 0
      ? typeInferenceService.inferCustomFieldSchema(parseResult.data, customColumns, customFieldMappings)
      : {};

  console.log('[DEBUG] Custom field schema inferred:', JSON.stringify(customFieldSchema, null, 2));

  const successfulLeads: any[] = [];
  const errors: ValidationError[] = [];

  console.log(`[DEBUG] Processing ${parseResult.data.length} rows...`);

  // Process each row
  for (let i = 0; i < parseResult.data.length; i++) {
    const row = parseResult.data[i];
    const lineNumber = i + 2; // +2 for header and 0-based index

    // Report progress every 500 rows
    if (i > 0 && i % 500 === 0) {
      console.log(`[leads/import] Progress: ${i}/${parseResult.data.length} rows processed (${successfulLeads.length} successful, ${errors.length} failed)`);
      if (onProgress) {
        try {
          await onProgress(i, successfulLeads.length, errors.length);
        } catch (_) { /* don't let progress callback errors stop the import */ }
      }
    }

    // Normalize phone number before validation
    if (row.phone) {
      const originalPhone = row.phone;
      row.phone = normalizePhoneNumber(row.phone, phonePrefix);
      if (originalPhone !== row.phone) {
        console.log(`[DEBUG ROW ${lineNumber}] Phone normalized: "${originalPhone}" -> "${row.phone}"`);
      }
    }

    // Validate row
    console.log(`[DEBUG ROW ${lineNumber}] Validating row:`, {
      email: row.email || 'MISSING',
      firstName: row.first_name || row.firstName || 'MISSING',
      lastName: row.last_name || row.lastName || 'MISSING',
      companyName: row.company_name || row.companyName || 'MISSING',
      validationMode,
      validationSchema
    });

    const rowErrors = validateRow(row, validationSchema, lineNumber);
    if (rowErrors.length > 0) {
      console.log(`[DEBUG ROW ${lineNumber}] Validation FAILED with ${rowErrors.length} errors:`, rowErrors);
      errors.push(...rowErrors);
      continue; // Skip this row
    }
    console.log(`[DEBUG ROW ${lineNumber}] Validation PASSED`);

    // Additional validation: Either firstName or companyName must be present
    // Note: Support both camelCase (unmapped CSV) and snake_case (after column mapping)
    // Extract and validate required fields
    // Note: Support both camelCase (unmapped CSV) and snake_case (after column mapping)
    const firstName = row.first_name || row.firstName;
    const lastName = row.last_name || row.lastName;
    const companyName = row.company_name || row.companyName || row.company;

    const hasFirstName = firstName && String(firstName).trim();
    const hasCompanyName = companyName && String(companyName).trim();
    if (!hasFirstName && !hasCompanyName) {
      errors.push({
        line: lineNumber,
        field: 'name',
        message: 'Either firstName or companyName is required',
      });
      continue; // Skip this row
    }

    // Declare leadData outside try block so it's available in catch block for logging
    let leadData: any;

    try {
      console.log(`[DEBUG ROW ${lineNumber}] Preparing lead data with email value:`, {
        rawEmail: row.email,
        emailType: typeof row.email,
        isNull: row.email === null,
        isUndefined: row.email === undefined,
        isEmpty: row.email === '',
        willBecome: row.email || undefined
      });

      // Transform data for database
      // IMPORTANT: Database schema requires firstName, lastName, and companyName to be NOT NULL
      // If we only have companyName (corporate lead), use "N/A" for name fields
      const leadScore = row.lead_score || row.leadScore;
      const estimatedValue = row.estimated_value || row.estimatedValue;
      const expectedCloseDate = row.expected_close_date || row.expectedCloseDate;
      const addressLine1 = row.address_line1 || row.addressLine1 || row.address || row.RegisteredAddress;
      const addressLine2 = row.address_line2 || row.addressLine2;
      const stateProvince = row.state_province || row.stateProvince || row.state || row.RegisteredAddressProvince;
      const postalCode = row.postal_code || row.postalCode;

      const hasLastName = lastName && String(lastName).trim();

      leadData = {
        workspaceId,
        firstName: hasFirstName ? String(firstName).trim() : 'N/A',
        lastName: hasLastName ? String(lastName).trim() : 'N/A',
        companyName: hasCompanyName ? String(companyName).trim() : 'N/A',
        email: row.email || undefined,
        phone: row.phone || row.mobile || undefined,
        source: row.source || 'import', // Default to 'import' if not provided
        status: row.status || 'new',
        leadScore: leadScore ? parseInt(leadScore.toString(), 10) : 0,
        estimatedValue: estimatedValue ? estimatedValue.toString() : undefined,
        expectedCloseDate: expectedCloseDate
          ? new Date(expectedCloseDate.toString())
          : undefined,
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId,
        // US-CRM-ADDR-002: Add address fields with CIPC mapping
        addressLine1: addressLine1 || undefined,
        addressLine2: addressLine2 || undefined,
        city: row.city || row.RegisteredAddressCity || undefined,
        stateProvince: stateProvince || undefined,
        postalCode: postalCode || undefined,
        country: row.country || 'South Africa', // Default for CIPC data
      };

      // Handle tags array
      if (row.tags) {
        leadData.tags = Array.isArray(row.tags)
          ? row.tags
          : row.tags.toString().split(',').map((t: string) => t.trim());
      }

      // Build custom fields from unmapped columns
      const customFields: Record<string, any> = {};

      console.log(`[DEBUG] Row ${lineNumber} - Building custom fields from unmapped columns:`);
      console.log(`[DEBUG]   - Row keys:`, Object.keys(row));
      console.log(`[DEBUG]   - Custom field mappings available:`, Object.keys(customFieldMappings));

      for (const [csvColumn, value] of Object.entries(row)) {
        console.log(`[DEBUG]   - Processing column "${csvColumn}" with value:`, value);

        // Skip standard fields and empty values
        if (STANDARD_FIELDS.has(csvColumn)) {
          console.log(`[DEBUG]     ✗ Skipping: "${csvColumn}" is a standard field`);
          continue;
        }

        if (value === null || value === undefined || value === '') {
          console.log(`[DEBUG]     ✗ Skipping: "${csvColumn}" has empty value`);
          continue;
        }

        // This is an unmapped column - treat as custom field
        try {
          // Use provided mapping or default to the column name
          const targetFieldName = customFieldMappings[csvColumn] || csvColumn;
          console.log(`[DEBUG]     → Mapping "${csvColumn}" to custom field "${targetFieldName}"`);

          const normalizedName = customFieldsService.normalizeFieldName(targetFieldName);
          console.log(`[DEBUG]     → Normalized custom field name: "${normalizedName}"`);

          customFields[normalizedName] = value;
          console.log(`[DEBUG]     ✓ Added custom field: ${normalizedName} = ${value}`);
        } catch (error) {
          // Field name validation failed - log warning and skip
          console.warn(
            `[DEBUG]     ✗ Skipping invalid custom field "${csvColumn}": ${(error as Error).message}`
          );
        }
      }

      console.log(`[DEBUG] Row ${lineNumber} - Custom fields collected:`, JSON.stringify(customFields, null, 2));

      // Validate custom fields if any were collected
      if (Object.keys(customFields).length > 0) {
        const validation = customFieldsService.validateCustomFields(customFields);
        console.log(`[DEBUG] Row ${lineNumber} - Custom fields validation:`, {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
        });

        if (!validation.valid) {
          errors.push({
            line: lineNumber,
            field: 'customFields',
            message: `Invalid custom fields: ${validation.errors.join(', ')}`,
          });
          console.log(`[DEBUG] Row ${lineNumber} - ✗ SKIPPING due to validation errors`);
          continue; // Skip this row
        }

        // Apply merge strategy for custom fields
        // For new leads, merge and replace produce the same result.
        // For duplicate updates (future), merge preserves existing fields while replace overwrites all.
        if (mergeStrategy === 'replace') {
          leadData.customFields = customFields;
        } else {
          // merge: overlay new custom fields onto any existing ones
          leadData.customFields = { ...(leadData.customFields || {}), ...customFields };
        }
        leadData.customFieldsSource = 'import';
        console.log(`[DEBUG] Row ${lineNumber} - ✓ Custom fields added to leadData (strategy: ${mergeStrategy})`);
      } else {
        console.log(`[DEBUG] Row ${lineNumber} - No custom fields to add`);
      }

      // Create lead
      console.log(`[DEBUG] Row ${lineNumber} - Final leadData before DB insert:`, JSON.stringify(leadData, null, 2));
      const lead = await leadService.create(db, leadData);
      console.log(`[DEBUG] Row ${lineNumber} - ✓ Successfully created lead ${lead.id}`);
      successfulLeads.push(lead);
    } catch (error) {
      console.error(`[DEBUG] Row ${lineNumber} - ✗ FAILED to create lead:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        leadData: leadData,
      });
      errors.push({
        line: lineNumber,
        field: 'database',
        message: error instanceof Error ? error.message : 'Failed to create lead',
      });
    }
  }

  console.log('========================================');
  console.log('[DEBUG] CSV IMPORT COMPLETE');
  console.log('[DEBUG] Total rows processed:', parseResult.data.length);
  console.log('[DEBUG] Successful imports:', successfulLeads.length);
  console.log('[DEBUG] Failed imports:', errors.length);
  if (errors.length > 0) {
    console.log('[DEBUG] First 5 errors:', errors.slice(0, 5).map(e => ({
      line: e.line,
      field: e.field,
      message: e.message,
    })));
  }
  console.log('========================================');

  // Create list for this import if there are successful leads
  if (successfulLeads.length === 0) {
    // Show detailed error report
    const errorSummary = errors.slice(0, 20).map(e =>
      `Line ${e.line} [${e.field}]: ${e.message}`
    ).join('\n  ');

    throw new Error(
      `No leads were successfully imported. Total rows: ${parseResult.data.length}, Failed: ${errors.length}\n` +
      `First 20 errors:\n  ${errorSummary}`
    );
  }

  // Generate unique list name with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const timeString = new Date()
    .toISOString()
    .split('T')[1]
    .split('.')[0]
    .replace(/:/g, '-');
  const listName = `${filename}_${timestamp}_${timeString}`;

  const importList = await listsService.createList(db, {
    workspaceId,
    entityType: 'lead',
    type: 'import',
    name: listName,
    description: `Auto-created from CSV import: ${filename} (${successfulLeads.length} leads)`,
    customFieldSchema,
    ownerId: userId,
    tags: ['csv-import', 'auto-created'],
    metadata: {
      importSource: 'csv',
      importedAt: new Date().toISOString(),
      filename,
      totalRows: parseResult.data.length,
      successCount: successfulLeads.length,
      failedCount: errors.length,
    },
    createdBy: userId,
  });

  // Add all imported leads to the list
  const leadIds = successfulLeads.map((l) => l.id);
  await listMembersService.addMembers(db, importList.id, workspaceId, leadIds, userId, 'import');

  console.log(`[leads/import] Created list ${importList.id} with ${successfulLeads.length} members`);

  // Create timeline event for successful imports
  if (successfulLeads.length > 0) {
    await timelineService.create(db, {
      workspaceId,
      entityType: 'lead',
      entityId: successfulLeads[0].id, // Link to first lead
      eventType: 'lead.imported',
      eventCategory: 'system',
      eventLabel: 'Leads Imported',
      summary: `Imported ${successfulLeads.length} leads from CSV and created list "${importList.name}"`,
      metadata: {
        successCount: successfulLeads.length,
        failedCount: errors.length,
        totalRows: parseResult.data.length,
        listId: importList.id,
        customFieldsDetected: customColumns.length,
        customFieldSchema,
      },
      occurredAt: new Date(),
      actorType: 'user',
      actorId: userId,
    });
  }

  return {
    listId: importList.id,
    leadsImported: successfulLeads.length,
    listName: importList.name,
    failed: errors.length,
    errors: errors.slice(0, 100), // Limit to first 100 errors
    customFieldsDetected: customColumns,
    customFieldSchema,
  };
}

/**
 * Extract standard lead fields from row
 */
function extractStandardFields(
  row: Record<string, any>,
  userId: string,
  workspaceId: string
): any {
  return {
    workspaceId,
    firstName: row.firstName || '',
    lastName: row.lastName || '',
    companyName: row.companyName || '',
    email: row.email || undefined,
    phone: row.phone || undefined,
    source: row.source || 'import',
    status: row.status || 'new',
    leadScore: row.leadScore ? parseInt(row.leadScore.toString(), 10) : 0,
    estimatedValue: row.estimatedValue ? row.estimatedValue.toString() : undefined,
    expectedCloseDate: row.expectedCloseDate ? new Date(row.expectedCloseDate.toString()) : undefined,
    ownerId: userId,
    createdBy: userId,
    updatedBy: userId,
  };
}

/**
 * Extract custom fields from row
 */
function extractCustomFields(
  row: Record<string, any>,
  customColumns: string[],
  customFieldMappings: Record<string, string> = {}
): Record<string, any> {
  const customFields: Record<string, any> = {};

  for (const column of customColumns) {
    const value = row[column];
    if (value !== undefined && value !== null && value !== '') {
      const targetFieldName = customFieldMappings[column] || column;
      try {
        const normalizedName = customFieldsService.normalizeFieldName(targetFieldName);
        customFields[normalizedName] = value;
      } catch (error) {
        console.warn(`[import] Skipping invalid custom field "${column}": ${(error as Error).message}`);
      }
    }
  }

  return customFields;
}

/**
 * Create a new import job in the database
 */
async function createImportJob(
  db: Database,
  params: {
    workspaceId: string;
    userId: string;
    filename: string;
    totalRows: number;
    columnMapping: Record<string, any>;
    duplicateStrategy?: string;
    validationMode?: string;
  }
): Promise<CrmLeadImport> {
  const [importJob] = await db
    .insert(crmLeadImports)
    .values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      filename: params.filename,
      totalRows: params.totalRows,
      processedRows: 0,
      importedRows: 0,
      errorRows: 0,
      columnMapping: params.columnMapping,
      duplicateStrategy: params.duplicateStrategy || 'skip',
      validationMode: params.validationMode || 'lenient',
      status: 'validating',
      startedAt: new Date(),
    })
    .returning();

  return importJob;
}

/**
 * Update import job progress
 */
async function updateImportProgress(
  db: Database,
  importId: string,
  workspaceId: string,
  update: {
    processedRows?: number;
    importedRows?: number;
    errorRows?: number;
    status?: 'validating' | 'importing' | 'completed' | 'failed';
    completedAt?: Date;
    errorFileUrl?: string;
    listId?: string; // ID of the created list
    errorDetails?: any[]; // Array of error objects with line, field, and message
  }
): Promise<CrmLeadImport | null> {
  const [updated] = await db
    .update(crmLeadImports)
    .set({
      ...update,
      updatedAt: new Date(),
    })
    .where(and(eq(crmLeadImports.id, importId), eq(crmLeadImports.workspaceId, workspaceId)))
    .returning();

  return updated || null;
}

/**
 * Get import job status
 */
async function getImportStatus(
  db: Database,
  importId: string,
  workspaceId: string
): Promise<CrmLeadImport | null> {
  const [importJob] = await db
    .select()
    .from(crmLeadImports)
    .where(and(eq(crmLeadImports.id, importId), eq(crmLeadImports.workspaceId, workspaceId)))
    .limit(1);

  return importJob || null;
}

export const leadsImportService = {
  importLeadsFromCSVString,
  extractStandardFields,
  extractCustomFields,
  createImportJob,
  updateImportProgress,
  getImportStatus,
};
