/**
 * Custom Fields Service
 * Handles validation, normalization, and merging of custom fields on contacts/leads
 */

/**
 * Reserved field names that cannot be used for custom fields
 * These are standard database columns that should not be overridden
 */
const RESERVED_FIELD_NAMES = [
  'id',
  'email',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'created_at',
  'createdat',
  'updated_at',
  'updatedat',
  'deleted_at',
  'deletedat',
  'workspace_id',
  'workspaceid',
  'owner_id',
  'ownerid',
  'account_id',
  'accountid',
  'phone',
  'mobile',
  // Note: 'title' and 'department' removed as they may be custom fields for some entities (e.g., leads)
  // while being standard columns for others (e.g., contacts)
  'status',
  'lifecycle_stage',
  'lifecyclestage',
  'lead_score',
  'leadscore',
  'engagement_score',
  'engagementscore',
  'tags',
  'custom_fields',
  'customfields',
  'can_be_revived',
  'canberevived',
  'revival_count',
  'revivalcount',
  'created_by',
  'createdby',
  'updated_by',
  'updatedby',
];

/**
 * Validation limits for custom fields
 */
const LIMITS = {
  MAX_FIELDS_PER_ENTITY: 100,
  MAX_FIELD_NAME_LENGTH: 64,
  MAX_FIELD_VALUE_SIZE: 5 * 1024, // 5KB per field
  MAX_TOTAL_SIZE: 100 * 1024, // 100KB total
};

/**
 * SQL injection patterns to detect and reject
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
  /(--|;|\/\*|\*\/|xp_|sp_)/gi,
  /('|('')|--|;|<|>|\/\*|\*\/)/gi,
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FieldTypeDetectionResult {
  type: 'string' | 'number' | 'boolean' | 'date';
  confidence: number; // 0-1
}

export type MergeStrategy = 'merge' | 'replace';

class CustomFieldsService {
  /**
   * Normalize field name to snake_case
   * - Convert to snake_case: "Income Bracket" → "income_bracket"
   * - Strip special characters (keep only alphanumeric + underscore)
   * - Lowercase
   * - Max 64 characters
   */
  normalizeFieldName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('Field name must be a non-empty string');
    }

    // Convert to lowercase and trim
    let normalized = name.trim().toLowerCase();

    // Replace spaces and hyphens with underscores
    normalized = normalized.replace(/[\s-]+/g, '_');

    // Remove all characters except alphanumeric and underscore
    normalized = normalized.replace(/[^a-z0-9_]/g, '');

    // Remove leading/trailing underscores
    normalized = normalized.replace(/^_+|_+$/g, '');

    // Remove consecutive underscores
    normalized = normalized.replace(/_+/g, '_');

    // Truncate to max length
    if (normalized.length > LIMITS.MAX_FIELD_NAME_LENGTH) {
      normalized = normalized.substring(0, LIMITS.MAX_FIELD_NAME_LENGTH);
    }

    // Ensure not empty after normalization
    if (!normalized) {
      throw new Error(`Field name must be a non-empty string`);
    }

    // Check for SQL injection patterns BEFORE normalization (on original input)
    for (const pattern of SQL_INJECTION_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex state
      if (pattern.test(name)) {
        throw new Error(`Field name "${name}" contains invalid characters or SQL keywords`);
      }
    }

    // Check against reserved words
    if (RESERVED_FIELD_NAMES.includes(normalized)) {
      throw new Error(
        `Field name "${normalized}" is reserved and cannot be used as a custom field`
      );
    }

    return normalized;
  }

  /**
   * Validate custom fields object
   * - Max 100 fields per entity
   * - Max 5KB per field value
   * - Max 100KB total size
   * - No SQL injection vectors in field names
   * - All field names must be normalized
   */
  validateCustomFields(fields: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fields || typeof fields !== 'object') {
      errors.push('Custom fields must be an object');
      return { valid: false, errors, warnings };
    }

    // Check if it's an array (common mistake)
    if (Array.isArray(fields)) {
      errors.push('Custom fields must be an object, not an array');
      return { valid: false, errors, warnings };
    }

    const fieldNames = Object.keys(fields);

    // Check field count
    if (fieldNames.length > LIMITS.MAX_FIELDS_PER_ENTITY) {
      errors.push(
        `Too many custom fields: ${fieldNames.length} (max: ${LIMITS.MAX_FIELDS_PER_ENTITY})`
      );
    }

    // Calculate total size
    const totalSize = JSON.stringify(fields).length;
    if (totalSize > LIMITS.MAX_TOTAL_SIZE) {
      errors.push(
        `Custom fields total size too large: ${totalSize} bytes (max: ${LIMITS.MAX_TOTAL_SIZE} bytes)`
      );
    }

    // Validate each field
    for (const fieldName of fieldNames) {
      // Check field name is normalized
      try {
        const normalized = this.normalizeFieldName(fieldName);
        if (normalized !== fieldName) {
          warnings.push(
            `Field name "${fieldName}" should be normalized to "${normalized}"`
          );
        }
      } catch (error) {
        errors.push(`Invalid field name "${fieldName}": ${(error as Error).message}`);
        continue;
      }

      // Check field value size
      const value = fields[fieldName];

      // Check for null/undefined (these are allowed but warn)
      if (value === null || value === undefined) {
        warnings.push(`Field "${fieldName}" has null/undefined value`);
        continue; // Skip size check for null/undefined
      }

      const valueSize = JSON.stringify(value).length;
      if (valueSize > LIMITS.MAX_FIELD_VALUE_SIZE) {
        errors.push(
          `Field "${fieldName}" value too large: ${valueSize} bytes (max: ${LIMITS.MAX_FIELD_VALUE_SIZE} bytes)`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect field type from multiple values
   * Analyzes array of values to determine the most likely type
   *
   * @param values - Array of values from the same field across multiple records
   * @returns Type detection result with confidence score
   */
  detectFieldType(values: any[]): FieldTypeDetectionResult {
    if (!values || values.length === 0) {
      return { type: 'string', confidence: 0 };
    }

    // Filter out null/undefined
    const validValues = values.filter((v) => v !== null && v !== undefined);
    if (validValues.length === 0) {
      return { type: 'string', confidence: 0 };
    }

    let booleanCount = 0;
    let numberCount = 0;
    let dateCount = 0;
    let stringCount = 0;

    for (const value of validValues) {
      // Check boolean
      if (typeof value === 'boolean') {
        booleanCount++;
        continue;
      }

      // Check number FIRST (including 0)
      if (typeof value === 'number' && !isNaN(value)) {
        numberCount++;
        continue;
      }

      // Check if string is numeric (including "0")
      const numericStr = String(value);
      const numValue = Number(numericStr);
      if (!isNaN(numValue) && numericStr.trim() !== '' && /^-?\d+\.?\d*$/.test(numericStr.trim())) {
        numberCount++;
        continue;
      }

      // Check if string representation is boolean-like (only for non-numeric strings)
      const strValue = String(value).toLowerCase().trim();
      if (['true', 'false', 'yes', 'no'].includes(strValue)) {
        booleanCount++;
        continue;
      }

      // Check date (ISO 8601 format or common date strings)
      if (typeof value === 'string') {
        const dateValue = new Date(value);
        if (!isNaN(dateValue.getTime())) {
          // Check if it looks like a date (not just any number)
          if (
            value.includes('-') ||
            value.includes('/') ||
            value.toLowerCase().includes('jan') ||
            value.toLowerCase().includes('feb') ||
            value.toLowerCase().includes('mar')
          ) {
            dateCount++;
            continue;
          }
        }
      }

      // Default to string
      stringCount++;
    }

    const total = validValues.length;
    const counts = [
      { type: 'boolean' as const, count: booleanCount },
      { type: 'number' as const, count: numberCount },
      { type: 'date' as const, count: dateCount },
      { type: 'string' as const, count: stringCount },
    ];

    // Find type with highest count
    const winner = counts.reduce((prev, current) =>
      current.count > prev.count ? current : prev
    );

    // Calculate confidence (percentage of values matching the detected type)
    const confidence = total > 0 ? winner.count / total : 0;

    return {
      type: winner.type,
      confidence,
    };
  }

  /**
   * Merge custom fields with different strategies
   *
   * @param existing - Existing custom fields object
   * @param incoming - Incoming custom fields to merge
   * @param strategy - Merge strategy: 'merge' (combine) or 'replace' (overwrite)
   * @returns Merged custom fields object
   */
  mergeCustomFields(
    existing: Record<string, any>,
    incoming: Record<string, any>,
    strategy: MergeStrategy = 'merge'
  ): Record<string, any> {
    if (!existing || typeof existing !== 'object') {
      existing = {};
    }

    if (!incoming || typeof incoming !== 'object') {
      return existing;
    }

    // Validate incoming fields
    const validation = this.validateCustomFields(incoming);
    if (!validation.valid) {
      throw new Error(`Invalid custom fields: ${validation.errors.join(', ')}`);
    }

    let result: Record<string, any>;

    switch (strategy) {
      case 'replace':
        // Replace: incoming completely overwrites existing
        result = { ...incoming };
        break;

      case 'merge':
      default:
        // Merge: combine both, incoming takes precedence on conflicts
        result = { ...existing, ...incoming };
        break;
    }

    // Final validation on merged result
    const finalValidation = this.validateCustomFields(result);
    if (!finalValidation.valid) {
      throw new Error(`Merged custom fields exceed limits: ${finalValidation.errors.join(', ')}`);
    }

    return result;
  }

  /**
   * Normalize all field names in a custom fields object
   * Useful for cleaning up imported data
   *
   * @param fields - Custom fields with potentially unnormalized names
   * @returns Custom fields with normalized names
   */
  normalizeCustomFields(fields: Record<string, any>): Record<string, any> {
    if (!fields || typeof fields !== 'object') {
      return {};
    }

    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(fields)) {
      try {
        const normalizedKey = this.normalizeFieldName(key);
        normalized[normalizedKey] = value;
      } catch (error) {
        // Skip invalid field names
        console.warn(`Skipping invalid field name "${key}": ${(error as Error).message}`);
      }
    }

    return normalized;
  }

  /**
   * Get field statistics for analytics
   * Useful for understanding custom field usage across a workspace
   *
   * @param allCustomFields - Array of custom fields objects from multiple records
   * @returns Statistics about field usage and types
   */
  getFieldStatistics(allCustomFields: Record<string, any>[]): {
    fieldNames: string[];
    fieldCounts: Record<string, number>;
    fieldTypes: Record<string, FieldTypeDetectionResult>;
  } {
    const fieldCounts: Record<string, number> = {};
    const fieldValues: Record<string, any[]> = {};

    // Count occurrences and collect values for each field
    for (const fields of allCustomFields) {
      if (!fields || typeof fields !== 'object') {
        continue;
      }

      for (const [fieldName, value] of Object.entries(fields)) {
        fieldCounts[fieldName] = (fieldCounts[fieldName] || 0) + 1;

        if (!fieldValues[fieldName]) {
          fieldValues[fieldName] = [];
        }
        fieldValues[fieldName].push(value);
      }
    }

    // Detect types for each field
    const fieldTypes: Record<string, FieldTypeDetectionResult> = {};
    for (const [fieldName, values] of Object.entries(fieldValues)) {
      fieldTypes[fieldName] = this.detectFieldType(values);
    }

    return {
      fieldNames: Object.keys(fieldCounts).sort(),
      fieldCounts,
      fieldTypes,
    };
  }
}

export const customFieldsService = new CustomFieldsService();
