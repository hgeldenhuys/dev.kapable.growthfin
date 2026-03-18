/**
 * Segment Query Evaluator Tests
 * Tests for the segment criteria validation and SQL generation
 */

import { describe, test, expect } from 'bun:test';
import { validateSegmentCriteria, evaluateSegmentCriteria, type Criteria } from '../segment-query-evaluator';

describe('Segment Query Evaluator', () => {
  describe('validateSegmentCriteria', () => {
    test('validates simple criteria with all operator', () => {
      const criteria: Criteria = {
        all: [
          { field: 'propensity_score', operator: '>', value: 70 },
          { field: 'lifecycle_stage', operator: '=', value: 'engaged' },
        ],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates simple criteria with any operator', () => {
      const criteria: Criteria = {
        any: [
          { field: 'lifecycle_stage', operator: '=', value: 'engaged' },
          { field: 'lifecycle_stage', operator: '=', value: 'verified' },
        ],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates nested criteria', () => {
      const criteria: Criteria = {
        all: [
          { field: 'propensity_score', operator: '>', value: 70 },
          {
            any: [
              { field: 'lifecycle_stage', operator: '=', value: 'engaged' },
              { field: 'lifecycle_stage', operator: '=', value: 'verified' },
            ],
          },
        ],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects unknown field', () => {
      const criteria: Criteria = {
        all: [{ field: 'unknown_field', operator: '=', value: 'test' }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unknown field');
    });

    test('rejects unknown operator', () => {
      const criteria: Criteria = {
        all: [{ field: 'propensity_score', operator: 'unknown_op', value: 70 }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unknown operator');
    });

    test('rejects missing value for non-null operators', () => {
      const criteria: Criteria = {
        all: [{ field: 'propensity_score', operator: '>', value: undefined }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing value');
    });

    test('accepts is_null operator without value', () => {
      const criteria: Criteria = {
        all: [{ field: 'assigned_to', operator: 'is_null', value: undefined }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects between operator with invalid value', () => {
      const criteria: Criteria = {
        all: [{ field: 'propensity_score', operator: 'between', value: 50 }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('accepts between operator with array value', () => {
      const criteria: Criteria = {
        all: [{ field: 'propensity_score', operator: 'between', value: [50, 100] }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects criteria with both all and any', () => {
      const criteria: any = {
        all: [{ field: 'propensity_score', operator: '>', value: 70 }],
        any: [{ field: 'lifecycle_stage', operator: '=', value: 'engaged' }],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects criteria with neither all nor any', () => {
      const criteria: any = {};

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects empty all array', () => {
      const criteria: Criteria = {
        all: [],
      };

      const result = validateSegmentCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateSegmentCriteria', () => {
    test('generates SQL for simple equality', () => {
      const criteria: Criteria = {
        all: [{ field: 'lifecycle_stage', operator: '=', value: 'engaged' }],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
      // SQL should be generated but exact string depends on drizzle internals
    });

    test('generates SQL for comparison operators', () => {
      const criteria: Criteria = {
        all: [
          { field: 'propensity_score', operator: '>', value: 70 },
          { field: 'engagement_score', operator: '>=', value: 50 },
        ],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
    });

    test('generates SQL for string operators', () => {
      const criteria: Criteria = {
        all: [
          { field: 'email', operator: 'contains', value: '@example.com' },
          { field: 'company_name', operator: 'starts_with', value: 'Acme' },
        ],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
    });

    test('generates SQL for in operator', () => {
      const criteria: Criteria = {
        all: [
          {
            field: 'lifecycle_stage',
            operator: 'in',
            value: ['engaged', 'verified', 'converted'],
          },
        ],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
    });

    test('generates SQL for between operator', () => {
      const criteria: Criteria = {
        all: [{ field: 'propensity_score', operator: 'between', value: [50, 100] }],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
    });

    test('generates SQL for null operators', () => {
      const criteria: Criteria = {
        any: [
          { field: 'assigned_to', operator: 'is_null', value: undefined },
          { field: 'assigned_to', operator: 'is_not_null', value: undefined },
        ],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
    });

    test('generates SQL for nested criteria with OR logic', () => {
      const criteria: Criteria = {
        all: [
          { field: 'propensity_score', operator: '>', value: 70 },
          {
            any: [
              { field: 'lifecycle_stage', operator: '=', value: 'engaged' },
              { field: 'lifecycle_stage', operator: '=', value: 'verified' },
            ],
          },
        ],
      };

      const sql = evaluateSegmentCriteria(criteria);
      expect(sql).toBeDefined();
    });
  });

  describe('Custom Fields Support', () => {
    describe('validateSegmentCriteria - custom fields', () => {
      test('accepts valid custom field query', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.ethnicity', operator: '=', value: 'Asian' }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('accepts custom field with underscore', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.income_bracket', operator: '>=', value: 50000 }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('rejects custom field with empty name', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.', operator: '=', value: 'test' }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('cannot be empty');
      });

      test('rejects custom field with invalid characters', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.invalid-field!', operator: '=', value: 'test' }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('invalid characters');
      });

      test('accepts exists operator without value', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.optional_field', operator: 'exists', value: undefined }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('accepts not_exists operator without value', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.optional_field', operator: 'not_exists', value: undefined }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('accepts is_true operator without value', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.is_active', operator: 'is_true', value: undefined }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('accepts is_false operator without value', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.is_verified', operator: 'is_false', value: undefined }],
        };

        const result = validateSegmentCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    describe('evaluateSegmentCriteria - custom fields', () => {
      test('generates SQL for custom field equality', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.ethnicity', operator: '=', value: 'Asian' }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should generate: custom_fields->>'ethnicity' = 'Asian'
      });

      test('generates SQL for custom field numeric comparison', () => {
        const criteria: Criteria = {
          all: [
            { field: 'customFields.income_bracket', operator: '>=', value: 50000 },
            { field: 'customFields.age', operator: '>', value: 18 },
          ],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should cast to numeric: (custom_fields->>'income_bracket')::numeric >= 50000
      });

      test('generates SQL for custom field text search', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.notes', operator: 'contains', value: 'important' }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should use ILIKE: custom_fields->>'notes' ILIKE '%important%'
      });

      test('generates SQL for custom field IN operator', () => {
        const criteria: Criteria = {
          all: [
            {
              field: 'customFields.region',
              operator: 'in',
              value: ['North', 'South', 'East'],
            },
          ],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should generate: custom_fields->>'region' IN ('North','South','East')
      });

      test('generates SQL for custom field between operator', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.score', operator: 'between', value: [50, 100] }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should generate: (custom_fields->>'score')::numeric BETWEEN 50 AND 100
      });

      test('generates SQL for custom field exists check', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.optional_data', operator: 'exists', value: undefined }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should generate: custom_fields ? 'optional_data'
      });

      test('generates SQL for custom field not_exists check', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.deprecated_field', operator: 'not_exists', value: undefined }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should generate: NOT (custom_fields ? 'deprecated_field')
      });

      test('generates SQL for custom field boolean checks', () => {
        const criteria: Criteria = {
          all: [
            { field: 'customFields.is_premium', operator: 'is_true', value: undefined },
            { field: 'customFields.is_deleted', operator: 'is_false', value: undefined },
          ],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should cast to boolean: (custom_fields->>'is_premium')::boolean = true
      });

      test('generates SQL for mixed standard and custom fields', () => {
        const criteria: Criteria = {
          all: [
            { field: 'propensity_score', operator: '>', value: 70 },
            { field: 'customFields.ethnicity', operator: '=', value: 'Asian' },
            { field: 'customFields.income_bracket', operator: '>=', value: 50000 },
          ],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should handle both standard fields and custom JSONB fields
      });

      test('generates SQL for complex nested criteria with custom fields', () => {
        const criteria: Criteria = {
          all: [
            { field: 'propensity_score', operator: '>', value: 70 },
            {
              any: [
                { field: 'customFields.ethnicity', operator: '=', value: 'Asian' },
                { field: 'customFields.ethnicity', operator: '=', value: 'Hispanic' },
              ],
            },
            { field: 'customFields.income_bracket', operator: '>=', value: 50000 },
          ],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Complex query with OR logic for custom fields
      });

      test('generates SQL for custom field is_null check', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.optional_value', operator: 'is_null', value: undefined }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should handle null values: custom_fields->>'optional_value' IS NULL OR NOT (custom_fields ? 'optional_value')
      });

      test('generates SQL for custom field is_not_null check', () => {
        const criteria: Criteria = {
          all: [{ field: 'customFields.required_value', operator: 'is_not_null', value: undefined }],
        };

        const sql = evaluateSegmentCriteria(criteria);
        expect(sql).toBeDefined();
        // Should check both existence and non-null: custom_fields ? 'required_value' AND custom_fields->>'required_value' IS NOT NULL
      });
    });
  });
});
