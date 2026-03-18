/**
 * CSV Utilities
 * Functions for parsing, validating, and generating CSV files
 */

import Papa from 'papaparse';

// ============================================================================
// TYPES
// ============================================================================

export interface ColumnMapping {
  [csvColumn: string]: string; // e.g., "Full Name" -> "firstName+lastName"
}

export interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

export interface ValidationError {
  line: number;
  field: string;
  message: string;
}

export interface CSVParseResult {
  data: ParsedRow[];
  errors: ValidationError[];
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse CSV file with optional column mapping
 */
export function parseCSV(csvContent: string, mapping?: ColumnMapping): CSVParseResult {
  const errors: ValidationError[] = [];
  const parsedData: ParsedRow[] = [];

  // Use PapaParse to parse the CSV
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      errors.push({
        line: error.row || 0,
        field: 'csv',
        message: error.message,
      });
    }
  }

  // Transform data with column mapping
  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as Record<string, string>;
    const transformedRow: ParsedRow = {};
    const lineNumber = i + 2; // +2 because of header row and 0-based index

    if (mapping) {
      // Apply column mapping
      for (const [csvColumn, targetField] of Object.entries(mapping)) {
        const value = row[csvColumn];

        // Handle special mappings like "firstName+lastName"
        if (targetField.includes('+')) {
          const fields = targetField.split('+');

          // Split value if it's a combined field
          if (value && fields.length === 2) {
            const parts = value.trim().split(/\s+/);
            if (parts.length >= 2) {
              transformedRow[fields[0]] = parts[0];
              transformedRow[fields[1]] = parts.slice(1).join(' ');
            } else if (parts.length === 1) {
              // If only one part, use it for first field
              transformedRow[fields[0]] = parts[0];
              transformedRow[fields[1]] = '';
            }
          }
        } else {
          // Direct mapping
          transformedRow[targetField] = value?.trim() || null;
        }
      }

      // Copy any unmapped columns
      for (const [key, value] of Object.entries(row)) {
        if (!mapping[key]) {
          transformedRow[key] = value?.trim() || null;
        }
      }
    } else {
      // No mapping, just clean the data
      for (const [key, value] of Object.entries(row)) {
        transformedRow[key] = value?.trim() || null;
      }
    }

    parsedData.push(transformedRow);
  }

  return { data: parsedData, errors };
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationSchema {
  required?: string[];
  email?: string[];
  phone?: string[];
  enum?: { [field: string]: string[] };
  date?: string[];
  number?: string[];
  boolean?: string[];
  custom?: { [field: string]: (value: any) => string | null }; // Returns error message or null
}

/**
 * Validate row data against schema
 */
export function validateRow(
  row: ParsedRow,
  schema: ValidationSchema,
  lineNumber: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!row[field] || (typeof row[field] === 'string' && row[field].toString().trim() === '')) {
        errors.push({
          line: lineNumber,
          field,
          message: `${field} is required`,
        });
      }
    }
  }

  // Email validation (only validate if not empty)
  if (schema.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const field of schema.email) {
      const value = row[field];
      // Only validate if value is present and not empty string
      if (value !== null && value !== undefined && value !== '' && typeof value === 'string' && value.trim()) {
        if (!emailRegex.test(value.toString())) {
          errors.push({
            line: lineNumber,
            field,
            message: `${field} must be a valid email address`,
          });
        }
      }
    }
  }

  // Phone validation (only validate if not empty)
  if (schema.phone) {
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    for (const field of schema.phone) {
      const value = row[field];
      // Only validate if value is present and not empty string
      if (value !== null && value !== undefined && value !== '' && typeof value === 'string' && value.trim()) {
        const valueStr = value.toString().trim();
        if (!phoneRegex.test(valueStr) || valueStr.replace(/\D/g, '').length < 10) {
          errors.push({
            line: lineNumber,
            field,
            message: `${field} must be a valid phone number (at least 10 digits)`,
          });
        }
      }
    }
  }

  // Enum validation
  if (schema.enum) {
    for (const [field, allowedValues] of Object.entries(schema.enum)) {
      const value = row[field];
      if (value && !allowedValues.includes(value.toString())) {
        errors.push({
          line: lineNumber,
          field,
          message: `${field} must be one of: ${allowedValues.join(', ')}`,
        });
      }
    }
  }

  // Date validation
  if (schema.date) {
    for (const field of schema.date) {
      const value = row[field];
      if (value) {
        const date = new Date(value.toString());
        if (isNaN(date.getTime())) {
          errors.push({
            line: lineNumber,
            field,
            message: `${field} must be a valid date`,
          });
        }
      }
    }
  }

  // Number validation
  if (schema.number) {
    for (const field of schema.number) {
      const value = row[field];
      if (value !== null && value !== undefined && value !== '') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push({
            line: lineNumber,
            field,
            message: `${field} must be a valid number`,
          });
        }
      }
    }
  }

  // Boolean validation
  if (schema.boolean) {
    for (const field of schema.boolean) {
      const value = row[field];
      if (value !== null && value !== undefined && value !== '') {
        const valueStr = value.toString().toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(valueStr)) {
          errors.push({
            line: lineNumber,
            field,
            message: `${field} must be a boolean value (true/false, yes/no, 1/0)`,
          });
        }
      }
    }
  }

  // Custom validation
  if (schema.custom) {
    for (const [field, validator] of Object.entries(schema.custom)) {
      // Pass the entire row to custom validators (allows multi-field validation)
      const errorMessage = validator(row);
      if (errorMessage) {
        errors.push({
          line: lineNumber,
          field,
          message: errorMessage,
        });
      }
    }
  }

  return errors;
}

// ============================================================================
// CSV GENERATION
// ============================================================================

/**
 * Generate CSV from array of objects
 */
export function generateCSV(data: any[], fields?: string[]): string {
  if (data.length === 0) {
    return '';
  }

  // Determine fields to include
  const selectedFields = fields || Object.keys(data[0]);

  // Use PapaParse to generate CSV
  const csv = Papa.unparse(data, {
    columns: selectedFields,
    header: true,
  });

  return csv;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert boolean-like values to actual boolean
 */
export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return false;

  const valueStr = value.toString().toLowerCase().trim();
  return ['true', '1', 'yes', 'y'].includes(valueStr);
}

/**
 * Parse array from string (comma-separated)
 */
export function parseArray(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return value
    .toString()
    .split(',')
    .map((item: string) => item.trim())
    .filter((item: string) => item.length > 0);
}

/**
 * Clean phone number (remove formatting)
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
