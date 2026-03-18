/**
 * Trigger Condition Evaluator
 * Evaluate AND/OR condition trees for campaign triggers
 */

export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'in' | 'not_in';

export interface TriggerCondition {
  field: string;
  operator: ComparisonOperator;
  value: any;
}

export interface TriggerConditionGroup {
  all?: TriggerCondition[]; // AND
  any?: TriggerCondition[]; // OR
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition: TriggerCondition, data: Record<string, any>): boolean {
  const { field, operator, value } = condition;

  // Get field value from data (supports nested fields with dot notation)
  const fieldValue = getNestedValue(data, field);

  switch (operator) {
    case '==':
      return fieldValue === value;

    case '!=':
      return fieldValue !== value;

    case '>':
      return Number(fieldValue) > Number(value);

    case '<':
      return Number(fieldValue) < Number(value);

    case '>=':
      return Number(fieldValue) >= Number(value);

    case '<=':
      return Number(fieldValue) <= Number(value);

    case 'contains':
      if (typeof fieldValue === 'string') {
        return fieldValue.includes(String(value));
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(value);
      }
      return false;

    case 'not_contains':
      if (typeof fieldValue === 'string') {
        return !fieldValue.includes(String(value));
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(value);
      }
      return true;

    case 'in':
      if (!Array.isArray(value)) {
        throw new Error('Value must be an array for "in" operator');
      }
      return value.includes(fieldValue);

    case 'not_in':
      if (!Array.isArray(value)) {
        throw new Error('Value must be an array for "not_in" operator');
      }
      return !value.includes(fieldValue);

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue({ user: { name: 'John' } }, 'user.name') => 'John'
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Evaluate a condition group (AND or OR)
 */
export function evaluateConditionGroup(
  group: TriggerConditionGroup,
  data: Record<string, any>
): boolean {
  // Handle 'all' (AND) conditions
  if (group.all) {
    if (!Array.isArray(group.all)) {
      throw new Error('all must be an array of conditions');
    }

    // All conditions must be true (AND)
    return group.all.every((condition) => evaluateCondition(condition, data));
  }

  // Handle 'any' (OR) conditions
  if (group.any) {
    if (!Array.isArray(group.any)) {
      throw new Error('any must be an array of conditions');
    }

    // At least one condition must be true (OR)
    return group.any.some((condition) => evaluateCondition(condition, data));
  }

  // If neither 'all' nor 'any' is specified, return false
  return false;
}

/**
 * Validate condition group structure
 */
export function validateConditionGroup(group: TriggerConditionGroup): void {
  if (!group.all && !group.any) {
    throw new Error('Condition group must have either "all" or "any" property');
  }

  if (group.all && group.any) {
    throw new Error('Condition group cannot have both "all" and "any" properties');
  }

  const conditions = group.all || group.any;

  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    throw new Error('Condition group must have at least one condition');
  }

  for (const condition of conditions) {
    if (!condition.field || typeof condition.field !== 'string') {
      throw new Error('Each condition must have a string "field" property');
    }

    if (!condition.operator) {
      throw new Error('Each condition must have an "operator" property');
    }

    if (condition.value === undefined) {
      throw new Error('Each condition must have a "value" property');
    }

    // Validate operator
    const validOperators: ComparisonOperator[] = [
      '==',
      '!=',
      '>',
      '<',
      '>=',
      '<=',
      'contains',
      'not_contains',
      'in',
      'not_in',
    ];

    if (!validOperators.includes(condition.operator)) {
      throw new Error(`Invalid operator: ${condition.operator}`);
    }

    // Validate value types for specific operators
    if ((condition.operator === 'in' || condition.operator === 'not_in') && !Array.isArray(condition.value)) {
      throw new Error(`Value must be an array for operator: ${condition.operator}`);
    }
  }
}

/**
 * Type guard to check if an object is a valid condition group
 */
export function isValidConditionGroup(obj: any): obj is TriggerConditionGroup {
  try {
    validateConditionGroup(obj);
    return true;
  } catch {
    return false;
  }
}
