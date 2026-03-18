/**
 * Custom Fields Service Tests
 */

import { describe, it, expect } from 'bun:test';
import { customFieldsService } from './custom-fields-service';

describe('CustomFieldsService', () => {
  describe('normalizeFieldName', () => {
    it('should convert to snake_case', () => {
      expect(customFieldsService.normalizeFieldName('Income Bracket')).toBe('income_bracket');
      expect(customFieldsService.normalizeFieldName('Annual Revenue')).toBe('annual_revenue');
      expect(customFieldsService.normalizeFieldName('Customer Type')).toBe('customer_type');
    });

    it('should handle hyphens', () => {
      expect(customFieldsService.normalizeFieldName('lead-source')).toBe('lead_source');
      expect(customFieldsService.normalizeFieldName('Company-Size')).toBe('company_size');
    });

    it('should strip special characters', () => {
      expect(customFieldsService.normalizeFieldName('Email (Personal)')).toBe('email_personal');
      expect(customFieldsService.normalizeFieldName('Phone #1')).toBe('phone_1');
      expect(customFieldsService.normalizeFieldName('Price $$$')).toBe('price');
    });

    it('should handle consecutive spaces and underscores', () => {
      expect(customFieldsService.normalizeFieldName('Multiple   Spaces')).toBe('multiple_spaces');
      expect(customFieldsService.normalizeFieldName('Under__score')).toBe('under_score');
    });

    it('should trim leading/trailing underscores', () => {
      expect(customFieldsService.normalizeFieldName('_leading')).toBe('leading');
      expect(customFieldsService.normalizeFieldName('trailing_')).toBe('trailing');
      expect(customFieldsService.normalizeFieldName('__both__')).toBe('both');
    });

    it('should lowercase everything', () => {
      expect(customFieldsService.normalizeFieldName('UPPERCASE')).toBe('uppercase');
      expect(customFieldsService.normalizeFieldName('MixedCase')).toBe('mixedcase');
    });

    it('should truncate to 64 characters', () => {
      const longName = 'a'.repeat(100);
      const normalized = customFieldsService.normalizeFieldName(longName);
      expect(normalized.length).toBe(64);
    });

    it('should reject reserved field names', () => {
      expect(() => customFieldsService.normalizeFieldName('id')).toThrow(/reserved/);
      expect(() => customFieldsService.normalizeFieldName('email')).toThrow(/reserved/);
      expect(() => customFieldsService.normalizeFieldName('First Name')).toThrow(/reserved/);
      expect(() => customFieldsService.normalizeFieldName('workspace_id')).toThrow(/reserved/);
      expect(() => customFieldsService.normalizeFieldName('created_at')).toThrow(/reserved/);
    });

    it('should reject SQL injection patterns', () => {
      expect(() => customFieldsService.normalizeFieldName('field; DROP TABLE')).toThrow(/invalid/);
      expect(() => customFieldsService.normalizeFieldName('field--comment')).toThrow(/invalid/);
    });

    it('should reject empty names', () => {
      expect(() => customFieldsService.normalizeFieldName('')).toThrow(/non-empty/);
      expect(() => customFieldsService.normalizeFieldName('   ')).toThrow(/non-empty/);
      expect(() => customFieldsService.normalizeFieldName('!!!')).toThrow(/non-empty/);
    });

    it('should handle unicode characters', () => {
      expect(customFieldsService.normalizeFieldName('Café Name')).toBe('caf_name');
      expect(customFieldsService.normalizeFieldName('Über-Score')).toBe('ber_score');
    });
  });

  describe('validateCustomFields', () => {
    it('should validate a valid custom fields object', () => {
      const fields = {
        industry: 'Technology',
        employee_count: 500,
        is_public: true,
      };

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object values', () => {
      const result1 = customFieldsService.validateCustomFields(null as any);
      expect(result1.valid).toBe(false);
      expect(result1.errors[0]).toContain('must be an object');

      const result2 = customFieldsService.validateCustomFields('string' as any);
      expect(result2.valid).toBe(false);
      expect(result2.errors[0]).toContain('must be an object');
    });

    it('should reject arrays', () => {
      const result = customFieldsService.validateCustomFields(['item1', 'item2'] as any);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not an array');
    });

    it('should reject too many fields', () => {
      const fields: Record<string, any> = {};
      for (let i = 0; i < 101; i++) {
        fields[`field_${i}`] = `value_${i}`;
      }

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Too many custom fields');
      expect(result.errors[0]).toContain('101');
    });

    it('should reject field values that are too large', () => {
      const largeValue = 'x'.repeat(6 * 1024); // 6KB
      const fields = {
        large_field: largeValue,
      };

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('value too large');
      expect(result.errors[0]).toContain('large_field');
    });

    it('should reject total size that is too large', () => {
      const fields: Record<string, any> = {};
      // Create 50 fields with 3KB each = 150KB total
      for (let i = 0; i < 50; i++) {
        fields[`field_${i}`] = 'x'.repeat(3 * 1024);
      }

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('total size too large'))).toBe(true);
    });

    it('should warn about unnormalized field names', () => {
      const fields = {
        'Income Bracket': 'High', // Not normalized (has space)
        employee_count: 500, // Normalized
      };

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('should be normalized');
      expect(result.warnings[0]).toContain('income_bracket');
    });

    it('should warn about null/undefined values', () => {
      const fields = {
        field1: null,
        field2: undefined,
        field3: 'valid',
      };

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings.some((w) => w.includes('field1'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('field2'))).toBe(true);
    });

    it('should reject invalid field names', () => {
      const fields = {
        id: 'value', // Reserved
        valid_field: 'value',
      };

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid field name');
      expect(result.errors[0]).toContain('reserved');
    });

    it('should handle complex nested objects', () => {
      const fields = {
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
        },
        preferences: {
          email: true,
          sms: false,
        },
      };

      const result = customFieldsService.validateCustomFields(fields);
      expect(result.valid).toBe(true);
    });
  });

  describe('detectFieldType', () => {
    it('should detect boolean type', () => {
      const values = [true, false, true, true];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('boolean');
      expect(result.confidence).toBe(1);
    });

    it('should detect boolean-like strings', () => {
      const values = ['true', 'false', 'yes', 'no'];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('boolean');
      expect(result.confidence).toBe(1);
    });

    it('should prioritize numbers over boolean-like values', () => {
      // '1' and '0' should be detected as numbers, not booleans
      const values = ['1', '0', '1', '0'];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('number');
      expect(result.confidence).toBe(1);
    });

    it('should detect number type', () => {
      const values = [100, 200, 300.5, 0];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('number');
      expect(result.confidence).toBe(1);
    });

    it('should detect numeric strings', () => {
      const values = ['100', '200', '300.5', '0'];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('number');
      expect(result.confidence).toBe(1);
    });

    it('should detect date type', () => {
      const values = [
        '2024-01-15',
        '2024-02-20T10:30:00Z',
        '2024/03/25',
        'Jan 15, 2024',
      ];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('date');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect string type', () => {
      const values = ['hello', 'world', 'test'];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('string');
      expect(result.confidence).toBe(1);
    });

    it('should handle mixed types with confidence', () => {
      const values = ['100', '200', 'not a number', '300'];
      const result = customFieldsService.detectFieldType(values);
      // Should detect number (3/4 = 0.75 confidence)
      expect(result.type).toBe('number');
      expect(result.confidence).toBe(0.75);
    });

    it('should filter out null/undefined values', () => {
      const values = [100, null, 200, undefined, 300];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('number');
      expect(result.confidence).toBe(1); // 3/3 valid values
    });

    it('should handle empty arrays', () => {
      const result = customFieldsService.detectFieldType([]);
      expect(result.type).toBe('string');
      expect(result.confidence).toBe(0);
    });

    it('should handle all null values', () => {
      const values = [null, null, undefined];
      const result = customFieldsService.detectFieldType(values);
      expect(result.type).toBe('string');
      expect(result.confidence).toBe(0);
    });
  });

  describe('mergeCustomFields', () => {
    it('should merge fields with merge strategy', () => {
      const existing = {
        field1: 'value1',
        field2: 'value2',
      };

      const incoming = {
        field2: 'updated2',
        field3: 'value3',
      };

      const result = customFieldsService.mergeCustomFields(existing, incoming, 'merge');
      expect(result).toEqual({
        field1: 'value1',
        field2: 'updated2', // Incoming takes precedence
        field3: 'value3',
      });
    });

    it('should replace fields with replace strategy', () => {
      const existing = {
        field1: 'value1',
        field2: 'value2',
      };

      const incoming = {
        field2: 'updated2',
        field3: 'value3',
      };

      const result = customFieldsService.mergeCustomFields(existing, incoming, 'replace');
      expect(result).toEqual({
        field2: 'updated2',
        field3: 'value3',
      });
      // field1 should be gone
      expect(result).not.toHaveProperty('field1');
    });

    it('should handle empty existing fields', () => {
      const existing = {};
      const incoming = {
        field1: 'value1',
      };

      const result = customFieldsService.mergeCustomFields(existing, incoming, 'merge');
      expect(result).toEqual({ field1: 'value1' });
    });

    it('should handle empty incoming fields', () => {
      const existing = {
        field1: 'value1',
      };
      const incoming = {};

      const result = customFieldsService.mergeCustomFields(existing, incoming, 'merge');
      expect(result).toEqual({ field1: 'value1' });
    });

    it('should handle null/undefined existing fields', () => {
      const incoming = {
        field1: 'value1',
      };

      const result1 = customFieldsService.mergeCustomFields(null as any, incoming, 'merge');
      expect(result1).toEqual({ field1: 'value1' });

      const result2 = customFieldsService.mergeCustomFields(undefined as any, incoming, 'merge');
      expect(result2).toEqual({ field1: 'value1' });
    });

    it('should validate incoming fields', () => {
      const existing = { field1: 'value1' };
      const invalid = { id: 'reserved_name' }; // Reserved field name

      expect(() => {
        customFieldsService.mergeCustomFields(existing, invalid, 'merge');
      }).toThrow(/Invalid custom fields/);
    });

    it('should reject merge that exceeds limits', () => {
      const existing: Record<string, any> = {};
      for (let i = 0; i < 60; i++) {
        existing[`field_${i}`] = `value_${i}`;
      }

      const incoming: Record<string, any> = {};
      for (let i = 60; i < 120; i++) {
        incoming[`field_${i}`] = `value_${i}`;
      }

      expect(() => {
        customFieldsService.mergeCustomFields(existing, incoming, 'merge');
      }).toThrow(/exceed limits/);
    });

    it('should default to merge strategy', () => {
      const existing = { field1: 'value1' };
      const incoming = { field2: 'value2' };

      const result = customFieldsService.mergeCustomFields(existing, incoming);
      expect(result).toEqual({
        field1: 'value1',
        field2: 'value2',
      });
    });
  });

  describe('normalizeCustomFields', () => {
    it('should normalize all field names', () => {
      const fields = {
        'Income Bracket': 'High',
        'Employee Count': 500,
        'Is Public': true,
      };

      const result = customFieldsService.normalizeCustomFields(fields);
      expect(result).toEqual({
        income_bracket: 'High',
        employee_count: 500,
        is_public: true,
      });
    });

    it('should skip invalid field names', () => {
      const fields = {
        valid_field: 'value1',
        id: 'reserved', // Reserved, should be skipped
        'Another Valid': 'value2',
      };

      const result = customFieldsService.normalizeCustomFields(fields);
      expect(result).toHaveProperty('valid_field');
      expect(result).toHaveProperty('another_valid');
      expect(result).not.toHaveProperty('id');
    });

    it('should handle empty object', () => {
      const result = customFieldsService.normalizeCustomFields({});
      expect(result).toEqual({});
    });

    it('should handle null/undefined', () => {
      const result1 = customFieldsService.normalizeCustomFields(null as any);
      expect(result1).toEqual({});

      const result2 = customFieldsService.normalizeCustomFields(undefined as any);
      expect(result2).toEqual({});
    });

    it('should preserve values unchanged', () => {
      const fields = {
        'Text Field': 'some text',
        'Number Field': 12345,
        'Boolean Field': true,
        'Object Field': { nested: 'value' },
        'Array Field': [1, 2, 3],
      };

      const result = customFieldsService.normalizeCustomFields(fields);
      expect(result.text_field).toBe('some text');
      expect(result.number_field).toBe(12345);
      expect(result.boolean_field).toBe(true);
      expect(result.object_field).toEqual({ nested: 'value' });
      expect(result.array_field).toEqual([1, 2, 3]);
    });
  });

  describe('getFieldStatistics', () => {
    it('should calculate field counts', () => {
      const allCustomFields = [
        { industry: 'Tech', employee_count: 100 },
        { industry: 'Finance', revenue: 1000000 },
        { industry: 'Healthcare', employee_count: 500 },
      ];

      const stats = customFieldsService.getFieldStatistics(allCustomFields);
      expect(stats.fieldCounts.industry).toBe(3);
      expect(stats.fieldCounts.employee_count).toBe(2);
      expect(stats.fieldCounts.revenue).toBe(1);
    });

    it('should detect field types across records', () => {
      const allCustomFields = [
        { employee_count: 100 },
        { employee_count: 200 },
        { employee_count: 300 },
      ];

      const stats = customFieldsService.getFieldStatistics(allCustomFields);
      expect(stats.fieldTypes.employee_count.type).toBe('number');
      expect(stats.fieldTypes.employee_count.confidence).toBe(1);
    });

    it('should list all unique field names', () => {
      const allCustomFields = [
        { field1: 'a', field2: 'b' },
        { field2: 'c', field3: 'd' },
        { field1: 'e', field3: 'f' },
      ];

      const stats = customFieldsService.getFieldStatistics(allCustomFields);
      expect(stats.fieldNames).toEqual(['field1', 'field2', 'field3']);
    });

    it('should handle empty array', () => {
      const stats = customFieldsService.getFieldStatistics([]);
      expect(stats.fieldNames).toEqual([]);
      expect(stats.fieldCounts).toEqual({});
      expect(stats.fieldTypes).toEqual({});
    });

    it('should skip null/invalid custom fields', () => {
      const allCustomFields = [
        { field1: 'value1' },
        null as any,
        undefined as any,
        { field2: 'value2' },
      ];

      const stats = customFieldsService.getFieldStatistics(allCustomFields);
      expect(stats.fieldNames).toEqual(['field1', 'field2']);
      expect(stats.fieldCounts.field1).toBe(1);
      expect(stats.fieldCounts.field2).toBe(1);
    });

    it('should sort field names alphabetically', () => {
      const allCustomFields = [
        { zebra: 'z', apple: 'a', middle: 'm' },
      ];

      const stats = customFieldsService.getFieldStatistics(allCustomFields);
      expect(stats.fieldNames).toEqual(['apple', 'middle', 'zebra']);
    });
  });

  describe('integration scenarios', () => {
    it('should handle AI enrichment workflow', () => {
      // Simulate AI enrichment adding custom fields
      const existing = {
        contact_phone: '+1234567890',
        contact_email: 'test@example.com',
      };

      const enriched = {
        company_size: '50-100',
        industry: 'Technology',
        annual_revenue: '5M-10M',
      };

      // Normalize incoming fields
      const normalized = customFieldsService.normalizeCustomFields(enriched);

      // Validate
      const validation = customFieldsService.validateCustomFields(normalized);
      expect(validation.valid).toBe(true);

      // Merge
      const result = customFieldsService.mergeCustomFields(existing, normalized, 'merge');
      expect(result).toHaveProperty('contact_phone');
      expect(result).toHaveProperty('company_size');
      expect(result).toHaveProperty('industry');
    });

    it('should handle bulk import workflow', () => {
      // Simulate importing contacts with custom fields
      const imported = [
        { 'Income Bracket': 'High', 'Customer Since': '2024-01-01' },
        { 'Income Bracket': 'Medium', 'Customer Since': '2024-02-01' },
        { 'Income Bracket': 'High', 'Customer Since': '2024-03-01' },
      ];

      // Normalize all
      const normalized = imported.map((fields) =>
        customFieldsService.normalizeCustomFields(fields)
      );

      // Get statistics
      const stats = customFieldsService.getFieldStatistics(normalized);
      expect(stats.fieldNames).toContain('income_bracket');
      expect(stats.fieldNames).toContain('customer_since');
      expect(stats.fieldTypes.customer_since.type).toBe('date');
    });

    it('should handle update with conflict resolution', () => {
      const existing = {
        industry: 'Technology',
        employee_count: 100,
        last_contact: '2024-01-01',
      };

      const userUpdate = {
        employee_count: 150, // User updates this
        annual_revenue: '10M', // User adds this
      };

      // User wants to merge (preserve last_contact)
      const merged = customFieldsService.mergeCustomFields(
        existing,
        userUpdate,
        'merge'
      );

      expect(merged.industry).toBe('Technology');
      expect(merged.employee_count).toBe(150); // Updated
      expect(merged.last_contact).toBe('2024-01-01'); // Preserved
      expect(merged.annual_revenue).toBe('10M'); // Added
    });
  });
});
