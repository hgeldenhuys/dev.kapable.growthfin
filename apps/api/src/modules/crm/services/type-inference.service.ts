/**
 * Type Inference Service
 * Infers data types from CSV data for custom field schema generation
 */

export interface FieldTypeInference {
  fieldName: string;
  inferredType: 'text' | 'number' | 'boolean' | 'date';
  confidence: number; // 0-1
  label: string; // Formatted name
}

export interface CustomFieldSchema {
  [fieldKey: string]: {  // Now uses the normalized field key, not CSV header
    type: 'text' | 'number' | 'boolean' | 'date';
    label: string;
    csvColumn?: string;  // Optional: original CSV column name
  };
}

/**
 * Infer custom field schema from CSV data
 * Analyzes data types and generates schema for custom fields
 *
 * @param csvData - Array of CSV rows
 * @param customColumns - CSV column names for custom fields
 * @param customFieldMappings - Optional mapping of CSV columns to field names
 * @returns Schema object keyed by normalized field names
 */
export function inferCustomFieldSchema(
  csvData: Record<string, any>[],
  customColumns: string[],
  customFieldMappings: Record<string, string> = {}
): CustomFieldSchema {
  const schema: CustomFieldSchema = {};

  // Import normalizeFieldName from custom-fields service
  const { customFieldsService } = require('../../../services/custom-fields-service');

  for (const column of customColumns) {
    // Skip empty column names (caused by trailing commas in CSV)
    if (!column || column.trim() === '') {
      continue;
    }

    const values = csvData.map((row) => row[column]).filter((v) => v != null && v !== '');

    // Get target field name (mapped or original column)
    const targetFieldName = customFieldMappings[column] || column;

    // Normalize field name for database storage - skip reserved/invalid names
    let normalizedKey: string;
    try {
      normalizedKey = customFieldsService.normalizeFieldName(targetFieldName);
    } catch (error) {
      console.warn(`[type-inference] Skipping column "${column}" (target: "${targetFieldName}"): ${(error as Error).message}`);
      continue;
    }

    // Format label from original CSV column (for display)
    const label = formatFieldLabel(column);

    if (values.length === 0) {
      // No data - default to text
      schema[normalizedKey] = {
        type: 'text',
        label,
        csvColumn: column,
      };
      continue;
    }

    const type = inferFieldType(values);

    schema[normalizedKey] = {
      type,
      label,
      csvColumn: column,
    };
  }

  return schema;
}

/**
 * Infer field type from array of values
 * Uses 90% threshold - if ≥90% of values match a type, use that type
 */
function inferFieldType(values: any[]): 'text' | 'number' | 'boolean' | 'date' {
  const sample = values.slice(0, Math.min(100, values.length));
  if (sample.length === 0) return 'text';

  const threshold = 0.9; // 90% must match

  // Test boolean first (most specific)
  const boolCount = sample.filter((v) => {
    const str = String(v).toLowerCase().trim();
    return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(str);
  }).length;
  if (boolCount / sample.length >= threshold) return 'boolean';

  // Test number
  const numberCount = sample.filter((v) => {
    const str = String(v).trim();
    if (str === '') return false;
    return !isNaN(Number(str)) && isFinite(Number(str));
  }).length;
  if (numberCount / sample.length >= threshold) return 'number';

  // Test date
  const dateCount = sample.filter((v) => {
    const str = String(v).trim();
    if (str === '') return false;
    const parsed = Date.parse(str);
    return !isNaN(parsed) && parsed > 0;
  }).length;
  if (dateCount / sample.length >= threshold) return 'date';

  // Default to text
  return 'text';
}

/**
 * Format field name to human-readable label
 * Examples:
 *   'first_name' -> 'First Name'
 *   'emailAddress' -> 'Email Address'
 *   'company_id' -> 'Company Id'
 */
function formatFieldLabel(columnName: string): string {
  // Handle snake_case
  if (columnName.includes('_')) {
    return columnName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Handle camelCase
  return (
    columnName
      // Insert space before uppercase letters
      .replace(/([A-Z])/g, ' $1')
      // Capitalize first letter
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  );
}

export const typeInferenceService = {
  inferCustomFieldSchema,
  inferFieldType,
  formatFieldLabel,
};
