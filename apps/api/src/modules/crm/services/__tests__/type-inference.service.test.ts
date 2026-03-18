/**
 * Unit Tests - Type Inference Service
 * Tests for US-LISTS-007 type inference logic
 */

import { describe, it, expect } from 'bun:test';
import { typeInferenceService } from '../type-inference.service';

describe('Type Inference Service', () => {
  describe('inferFieldType', () => {
    it('should infer number type for numeric values', () => {
      const data = [
        { score: '95' },
        { score: '87' },
        { score: '92' },
        { score: '78' },
        { score: '85' },
        { score: '90' },
        { score: '88' },
        { score: '93' },
        { score: '79' },
        { score: '91' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['score']);
      expect(schema.score.type).toBe('number');
    });

    it('should infer boolean type for boolean values', () => {
      const data = [
        { active: 'true' },
        { active: 'false' },
        { active: 'yes' },
        { active: 'no' },
        { active: '1' },
        { active: '0' },
        { active: 'TRUE' },
        { active: 'FALSE' },
        { active: 'Yes' },
        { active: 'No' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['active']);
      expect(schema.active.type).toBe('boolean');
    });

    it('should infer date type for date values', () => {
      const data = [
        { created: '2024-01-15' },
        { created: '2024-02-20' },
        { created: '2024-03-10' },
        { created: '2024-04-05' },
        { created: '2024-05-12' },
        { created: '2024-06-18' },
        { created: '2024-07-22' },
        { created: '2024-08-30' },
        { created: '2024-09-14' },
        { created: '2024-10-25' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['created']);
      expect(schema.created.type).toBe('date');
    });

    it('should infer text type for mixed values', () => {
      const data = [
        { mixed: '100' },
        { mixed: 'text_value' },
        { mixed: '2024-01-15' },
        { mixed: 'true' },
        { mixed: 'another_text' },
        { mixed: '999' },
        { mixed: 'mixed_data' },
        { mixed: 'false' },
        { mixed: 'some_value' },
        { mixed: '12345' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['mixed']);
      expect(schema.mixed.type).toBe('text');
    });

    it('should default to text for empty values', () => {
      const data = [
        { empty: '' },
        { empty: '' },
        { empty: '' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['empty']);
      expect(schema.empty.type).toBe('text');
    });

    it('should handle 90% threshold correctly', () => {
      // 9 out of 10 are numbers (90%) - should infer as number
      const data = [
        { field: '100' },
        { field: '200' },
        { field: '300' },
        { field: '400' },
        { field: '500' },
        { field: '600' },
        { field: '700' },
        { field: '800' },
        { field: '900' },
        { field: 'not_a_number' }, // 10% non-numeric
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['field']);
      expect(schema.field.type).toBe('number');
    });

    it('should default to text when below 90% threshold', () => {
      // Only 8 out of 10 are numbers (80%) - should default to text
      const data = [
        { field: '100' },
        { field: '200' },
        { field: '300' },
        { field: '400' },
        { field: '500' },
        { field: '600' },
        { field: '700' },
        { field: '800' },
        { field: 'not_a_number' },
        { field: 'also_not_a_number' }, // 20% non-numeric
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['field']);
      expect(schema.field.type).toBe('text');
    });
  });

  describe('formatFieldLabel', () => {
    it('should format snake_case to Title Case', () => {
      expect(typeInferenceService.formatFieldLabel('first_name')).toBe('First Name');
      expect(typeInferenceService.formatFieldLabel('email_address')).toBe('Email Address');
      expect(typeInferenceService.formatFieldLabel('company_id')).toBe('Company Id');
    });

    it('should format camelCase to Title Case', () => {
      expect(typeInferenceService.formatFieldLabel('firstName')).toBe('First Name');
      expect(typeInferenceService.formatFieldLabel('emailAddress')).toBe('Email Address');
      expect(typeInferenceService.formatFieldLabel('companyId')).toBe('Company Id');
    });

    it('should handle single word fields', () => {
      expect(typeInferenceService.formatFieldLabel('name')).toBe('Name');
      expect(typeInferenceService.formatFieldLabel('age')).toBe('Age');
    });

    it('should handle uppercase fields', () => {
      expect(typeInferenceService.formatFieldLabel('ID')).toBe('I D');
      expect(typeInferenceService.formatFieldLabel('URLPath')).toBe('U R L Path');
    });
  });

  describe('inferCustomFieldSchema', () => {
    it('should infer schema for multiple fields', () => {
      const data = [
        {
          age: '35',
          active: 'true',
          joined: '2024-01-15',
          department: 'Engineering',
        },
        {
          age: '28',
          active: 'false',
          joined: '2024-02-20',
          department: 'Sales',
        },
        {
          age: '42',
          active: 'yes',
          joined: '2024-03-10',
          department: 'Marketing',
        },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, [
        'age',
        'active',
        'joined',
        'department',
      ]);

      expect(schema.age).toEqual({ type: 'number', label: 'Age' });
      expect(schema.active).toEqual({ type: 'boolean', label: 'Active' });
      expect(schema.joined).toEqual({ type: 'date', label: 'Joined' });
      expect(schema.department).toEqual({ type: 'text', label: 'Department' });
    });

    it('should handle empty column list', () => {
      const data = [{ name: 'Test' }];
      const schema = typeInferenceService.inferCustomFieldSchema(data, []);
      expect(Object.keys(schema).length).toBe(0);
    });

    it('should handle null and undefined values', () => {
      const data = [
        { field: '100' },
        { field: null },
        { field: undefined },
        { field: '' },
        { field: '200' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['field']);
      // Should only analyze non-null/non-empty values
      expect(schema.field.type).toBe('number');
    });

    it('should analyze only first 100 rows for large datasets', () => {
      // Create 200 rows, first 100 are numbers, last 100 are text
      const data = [];
      for (let i = 0; i < 100; i++) {
        data.push({ field: String(i) });
      }
      for (let i = 0; i < 100; i++) {
        data.push({ field: `text_${i}` });
      }

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['field']);
      // Should infer as number because it only analyzes first 100 rows
      expect(schema.field.type).toBe('number');
    });

    it('should handle decimal numbers', () => {
      const data = [
        { price: '19.99' },
        { price: '29.50' },
        { price: '15.75' },
        { price: '99.99' },
        { price: '5.25' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['price']);
      expect(schema.price.type).toBe('number');
    });

    it('should handle negative numbers', () => {
      const data = [
        { temperature: '-5' },
        { temperature: '-10' },
        { temperature: '0' },
        { temperature: '5' },
        { temperature: '-2' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['temperature']);
      expect(schema.temperature.type).toBe('number');
    });

    it('should handle various date formats', () => {
      const data = [
        { date: '2024-01-15' },
        { date: '01/15/2024' },
        { date: 'Jan 15, 2024' },
        { date: '2024-01-15T10:30:00Z' },
        { date: '15 Jan 2024' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['date']);
      expect(schema.date.type).toBe('date');
    });

    it('should prioritize boolean over other types', () => {
      // All boolean values should be detected even if they look like numbers
      const data = [
        { flag: '1' },
        { flag: '0' },
        { flag: 'true' },
        { flag: 'false' },
        { flag: 'yes' },
        { flag: 'no' },
      ];

      const schema = typeInferenceService.inferCustomFieldSchema(data, ['flag']);
      expect(schema.flag.type).toBe('boolean');
    });
  });
});
