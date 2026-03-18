/**
 * Segment Query Evaluator
 * Converts JSON criteria into SQL WHERE clauses for dynamic segment filtering
 */

import { sql, SQL } from 'drizzle-orm';

export interface Condition {
  field: string;
  operator: string;
  value: any;
}

export interface Criteria {
  type?: 'and' | 'or';
  conditions?: (Condition | Criteria)[];
  all?: (Condition | Criteria)[];
  any?: (Condition | Criteria)[];
}

/**
 * Evaluate segment criteria recursively, building SQL WHERE clause
 */
export function evaluateSegmentCriteria(criteria: Criteria): SQL {
  // Support both {type: "and", conditions: [...]} and {all: [...]} formats
  const isAndType = criteria.type === 'and' || criteria.all;
  const isOrType = criteria.type === 'or' || criteria.any;
  const conditionsList = criteria.conditions || criteria.all || criteria.any;

  if (conditionsList && conditionsList.length > 0) {
    const conditions = conditionsList.map((c) => {
      if ('field' in c) {
        return buildCondition(c as Condition);
      } else {
        return evaluateSegmentCriteria(c as Criteria);
      }
    });

    if (isAndType) {
      return sql.join(conditions, sql` AND `);
    } else if (isOrType) {
      return sql.join(conditions, sql` OR `);
    }
  }

  return sql`true`;
}

/**
 * Build a single condition SQL fragment
 */
function buildCondition(condition: Condition): SQL {
  const { field, operator, value } = condition;

  // Check if this is a custom field query
  if (field.startsWith('customFields.')) {
    return buildCustomFieldCondition(field, operator, value);
  }

  // Sanitize field name to prevent SQL injection
  const fieldName = field.replace(/[^a-zA-Z0-9_]/g, '');

  switch (operator) {
    case '=':
    case 'equals':
      return sql.raw(`${fieldName} = '${escapeSqlValue(value)}'`);

    case '!=':
    case 'not_equals':
      return sql.raw(`${fieldName} != '${escapeSqlValue(value)}'`);

    case '>':
    case 'greater_than':
      return sql.raw(`${fieldName} > ${value}`);

    case '<':
    case 'less_than':
      return sql.raw(`${fieldName} < ${value}`);

    case '>=':
    case 'greater_than_or_equal':
      return sql.raw(`${fieldName} >= ${value}`);

    case '<=':
    case 'less_than_or_equal':
      return sql.raw(`${fieldName} <= ${value}`);

    case 'contains':
      return sql.raw(`${fieldName} ILIKE '%${escapeSqlValue(value)}%'`);

    case 'starts_with':
      return sql.raw(`${fieldName} ILIKE '${escapeSqlValue(value)}%'`);

    case 'ends_with':
      return sql.raw(`${fieldName} ILIKE '%${escapeSqlValue(value)}'`);

    case 'in':
      const inValues = Array.isArray(value)
        ? value.map((v) => `'${escapeSqlValue(v)}'`).join(',')
        : `'${escapeSqlValue(value)}'`;
      return sql.raw(`${fieldName} IN (${inValues})`);

    case 'not_in':
      const notInValues = Array.isArray(value)
        ? value.map((v) => `'${escapeSqlValue(v)}'`).join(',')
        : `'${escapeSqlValue(value)}'`;
      return sql.raw(`${fieldName} NOT IN (${notInValues})`);

    case 'between':
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error('between operator requires array of 2 values');
      }
      return sql.raw(`${fieldName} BETWEEN ${value[0]} AND ${value[1]}`);

    case 'is_null':
      return sql.raw(`${fieldName} IS NULL`);

    case 'is_not_null':
      return sql.raw(`${fieldName} IS NOT NULL`);

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

/**
 * Build a custom field condition using JSONB operators
 * Handles queries like "customFields.ethnicity" = "Asian"
 */
function buildCustomFieldCondition(field: string, operator: string, value: any): SQL {
  // Extract field name from "customFields.fieldName"
  const customFieldName = field.substring(13); // Remove "customFields." prefix

  // Sanitize custom field name
  const sanitizedFieldName = customFieldName.replace(/[^a-zA-Z0-9_]/g, '');

  switch (operator) {
    case '=':
    case 'equals':
      // Text comparison: custom_fields->>'field' = 'value'
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' = '${escapeSqlValue(value)}'`);

    case '!=':
    case 'not_equals':
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' != '${escapeSqlValue(value)}'`);

    case '>':
    case 'greater_than':
      // Numeric comparison: cast to numeric
      return sql.raw(`(custom_fields->>'${sanitizedFieldName}')::numeric > ${value}`);

    case '<':
    case 'less_than':
      return sql.raw(`(custom_fields->>'${sanitizedFieldName}')::numeric < ${value}`);

    case '>=':
    case 'greater_than_or_equal':
      return sql.raw(`(custom_fields->>'${sanitizedFieldName}')::numeric >= ${value}`);

    case '<=':
    case 'less_than_or_equal':
      return sql.raw(`(custom_fields->>'${sanitizedFieldName}')::numeric <= ${value}`);

    case 'contains':
      // Case-insensitive text search
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' ILIKE '%${escapeSqlValue(value)}%'`);

    case 'starts_with':
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' ILIKE '${escapeSqlValue(value)}%'`);

    case 'ends_with':
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' ILIKE '%${escapeSqlValue(value)}'`);

    case 'in':
      // IN operator for array of values
      const inValues = Array.isArray(value)
        ? value.map((v) => `'${escapeSqlValue(v)}'`).join(',')
        : `'${escapeSqlValue(value)}'`;
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' IN (${inValues})`);

    case 'not_in':
      const notInValues = Array.isArray(value)
        ? value.map((v) => `'${escapeSqlValue(v)}'`).join(',')
        : `'${escapeSqlValue(value)}'`;
      return sql.raw(`custom_fields->>'${sanitizedFieldName}' NOT IN (${notInValues})`);

    case 'between':
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error('between operator requires array of 2 values');
      }
      return sql.raw(
        `(custom_fields->>'${sanitizedFieldName}')::numeric BETWEEN ${value[0]} AND ${value[1]}`
      );

    case 'exists':
      // Check if field exists in JSONB: custom_fields ? 'field'
      return sql.raw(`custom_fields ? '${sanitizedFieldName}'`);

    case 'not_exists':
      return sql.raw(`NOT (custom_fields ? '${sanitizedFieldName}')`);

    case 'is_null':
      // Field exists but value is null, OR field doesn't exist
      return sql.raw(
        `(custom_fields->>'${sanitizedFieldName}' IS NULL OR NOT (custom_fields ? '${sanitizedFieldName}'))`
      );

    case 'is_not_null':
      // Field exists AND has a non-null value
      return sql.raw(
        `(custom_fields ? '${sanitizedFieldName}' AND custom_fields->>'${sanitizedFieldName}' IS NOT NULL)`
      );

    case 'is_true':
      // Boolean check
      return sql.raw(`(custom_fields->>'${sanitizedFieldName}')::boolean = true`);

    case 'is_false':
      return sql.raw(`(custom_fields->>'${sanitizedFieldName}')::boolean = false`);

    default:
      throw new Error(`Unsupported operator for custom fields: ${operator}`);
  }
}

/**
 * Escape SQL string values to prevent injection
 */
function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/'/g, "''");
}

/**
 * Validate segment criteria structure and fields
 */
export function validateSegmentCriteria(criteria: Criteria): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  function validate(c: Criteria | Condition, path: string = 'root') {
    if ('field' in c) {
      const condition = c as Condition;

      // Check if this is a custom field
      const isCustomField = condition.field.startsWith('customFields.');

      if (!isCustomField) {
        // Validate standard field exists
        const allowedFields = [
          'propensity_score',
          'engagement_score',
          'fit_score',
          'composite_score',
          'lifecycle_stage',
          'source',
          'industry',
          'company_size',
          'revenue',
          'email',
          'phone',
          'company_name',
          'first_name',
          'last_name',
          'assigned_to',
          'status',
          'created_at',
          'updated_at',
        ];

        if (!allowedFields.includes(condition.field)) {
          errors.push(`${path}: Unknown field '${condition.field}'`);
        }
      } else {
        // Validate custom field name format
        const customFieldName = condition.field.substring(13);
        if (!customFieldName || customFieldName.length === 0) {
          errors.push(`${path}: Custom field name cannot be empty`);
        }
        // Check for valid characters in custom field name
        if (!/^[a-zA-Z0-9_]+$/.test(customFieldName)) {
          errors.push(
            `${path}: Custom field name '${customFieldName}' contains invalid characters (use only letters, numbers, underscore)`
          );
        }
      }

      // Validate operator
      const allowedOperators = [
        '=',
        '!=',
        '>',
        '<',
        '>=',
        '<=',
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'greater_than_or_equal',
        'less_than_or_equal',
        'contains',
        'starts_with',
        'ends_with',
        'in',
        'not_in',
        'between',
        'is_null',
        'is_not_null',
        'exists',
        'not_exists',
        'is_true',
        'is_false',
      ];

      if (!allowedOperators.includes(condition.operator)) {
        errors.push(`${path}: Unknown operator '${condition.operator}'`);
      }

      // Validate value
      if (
        condition.value === undefined &&
        !['is_null', 'is_not_null', 'exists', 'not_exists', 'is_true', 'is_false'].includes(
          condition.operator
        )
      ) {
        errors.push(`${path}: Missing value for operator '${condition.operator}'`);
      }

      // Validate between operator value
      if (condition.operator === 'between') {
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          errors.push(`${path}: 'between' operator requires array of 2 values`);
        }
      }

      // Validate in/not_in operator value
      if (['in', 'not_in'].includes(condition.operator)) {
        if (!Array.isArray(condition.value) && typeof condition.value !== 'string') {
          errors.push(
            `${path}: '${condition.operator}' operator requires array or string value`
          );
        }
      }
    } else {
      const criteriaObj = c as Criteria;

      // Support both formats: {type, conditions} and {all/any}
      const hasNewFormat = criteriaObj.type && criteriaObj.conditions;
      const hasOldFormat = criteriaObj.all || criteriaObj.any;

      if (!hasNewFormat && !hasOldFormat) {
        errors.push(`${path}: Criteria must have either 'type'+'conditions' or 'all'/'any' property`);
      }

      if (criteriaObj.all && criteriaObj.any) {
        errors.push(`${path}: Criteria cannot have both 'all' and 'any' properties`);
      }

      if (criteriaObj.all) {
        if (!Array.isArray(criteriaObj.all) || criteriaObj.all.length === 0) {
          errors.push(`${path}: 'all' property must be non-empty array`);
        } else {
          for (let i = 0; i < criteriaObj.all.length; i++) {
            validate(criteriaObj.all[i], `${path}.all[${i}]`);
          }
        }
      }

      if (criteriaObj.any) {
        if (!Array.isArray(criteriaObj.any) || criteriaObj.any.length === 0) {
          errors.push(`${path}: 'any' property must be non-empty array`);
        } else {
          for (let i = 0; i < criteriaObj.any.length; i++) {
            validate(criteriaObj.any[i], `${path}.any[${i}]`);
          }
        }
      }

      // Validate new format {type, conditions}
      if (criteriaObj.conditions) {
        if (!Array.isArray(criteriaObj.conditions) || criteriaObj.conditions.length === 0) {
          errors.push(`${path}: 'conditions' property must be non-empty array`);
        } else {
          for (let i = 0; i < criteriaObj.conditions.length; i++) {
            validate(criteriaObj.conditions[i], `${path}.conditions[${i}]`);
          }
        }
      }
    }
  }

  validate(criteria);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Example usage:
 *
 * const criteria = {
 *   all: [
 *     { field: 'propensity_score', operator: '>', value: 70 },
 *     {
 *       any: [
 *         { field: 'lifecycle_stage', operator: '=', value: 'engaged' },
 *         { field: 'lifecycle_stage', operator: '=', value: 'verified' }
 *       ]
 *     }
 *   ]
 * };
 *
 * const whereClause = evaluateSegmentCriteria(criteria);
 * const validation = validateSegmentCriteria(criteria);
 */
