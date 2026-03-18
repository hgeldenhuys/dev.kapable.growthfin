/**
 * Data Quality Validators
 * Field-level validation rules for lead data quality
 * Epic 5 - Sprint 2: US-LEAD-QUALITY-006
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}

export interface FieldValidator {
  field: string;
  validate: (value: any) => ValidationResult;
  required?: boolean; // Is this field required?
}

/**
 * Email validator
 * Checks format and disposable email domains
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email) {
    return {
      valid: false,
      reason: 'Missing email',
      suggestion: 'Email is required for lead contact',
    };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      reason: 'Invalid email format',
      suggestion: 'Update to valid email address (e.g., name@company.com)',
    };
  }

  // Check for disposable email domains
  const disposableDomains = [
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    'temp-mail.org',
  ];

  const domain = email.split('@')[1].toLowerCase();
  if (disposableDomains.includes(domain)) {
    return {
      valid: false,
      reason: 'Disposable email domain',
      suggestion: 'Request business email address',
    };
  }

  return { valid: true };
}

/**
 * Phone validator
 * Checks international phone format
 */
export function validatePhone(phone: string | null | undefined): ValidationResult {
  if (!phone) {
    // Phone is optional, so null/empty is valid
    return { valid: true };
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // International phone format: optional + followed by 1-15 digits
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  if (!phoneRegex.test(cleaned)) {
    return {
      valid: false,
      reason: 'Invalid phone format',
      suggestion: 'Use international format (e.g., +1234567890)',
    };
  }

  return { valid: true };
}

/**
 * Website/URL validator
 */
export function validateWebsite(website: string | null | undefined): ValidationResult {
  if (!website) {
    // Website is optional
    return { valid: true };
  }

  try {
    // Prepend http:// if no protocol specified
    const urlString = website.startsWith('http') ? website : `https://${website}`;
    new URL(urlString);
    return { valid: true };
  } catch {
    return {
      valid: false,
      reason: 'Invalid URL format',
      suggestion: 'Enter valid website URL (e.g., www.company.com)',
    };
  }
}

/**
 * Required field validator
 * Checks if a required field has a value
 */
export function validateRequired(
  fieldName: string,
  value: any
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      valid: false,
      reason: `Missing required field: ${fieldName}`,
      suggestion: `Add ${fieldName} to enable proper lead qualification`,
    };
  }

  return { valid: true };
}

/**
 * Name validator
 * Checks if name looks reasonable
 */
export function validateName(name: string | null | undefined, fieldName: string): ValidationResult {
  if (!name) {
    return {
      valid: false,
      reason: `Missing ${fieldName}`,
      suggestion: `Add ${fieldName} for personalized outreach`,
    };
  }

  // Check minimum length
  if (name.trim().length < 2) {
    return {
      valid: false,
      reason: `${fieldName} too short`,
      suggestion: `Enter full ${fieldName}`,
    };
  }

  // Check for suspicious patterns (all numbers, special chars only)
  const suspiciousPattern = /^[^a-zA-Z]+$/;
  if (suspiciousPattern.test(name)) {
    return {
      valid: false,
      reason: `${fieldName} contains no letters`,
      suggestion: `Enter valid ${fieldName}`,
    };
  }

  return { valid: true };
}

/**
 * Complete set of field validators
 */
export const FIELD_VALIDATORS: FieldValidator[] = [
  {
    field: 'email',
    validate: validateEmail,
    required: true,
  },
  {
    field: 'phone',
    validate: validatePhone,
    required: false,
  },
  {
    field: 'website',
    validate: validateWebsite,
    required: false,
  },
  {
    field: 'first_name',
    validate: (value) => validateName(value, 'first name'),
    required: false, // Optional but recommended
  },
  {
    field: 'last_name',
    validate: (value) => validateName(value, 'last name'),
    required: false, // Optional but recommended
  },
  {
    field: 'company',
    validate: (value) => validateRequired('company', value),
    required: true,
  },
];

/**
 * Required fields configuration
 * Defines which fields are required at different lifecycle stages
 */
export const REQUIRED_FIELDS = {
  lead: ['status', 'lifecycle_stage'],
  contact: ['email'], // Either first_name or last_name required (checked separately)
  account: ['name'],
};

/**
 * Validate all fields for a lead/contact/account
 * @param data - Data object to validate
 * @param validators - Array of validators to apply
 * @returns Validation results map
 */
export function validateFields(
  data: Record<string, any>,
  validators: FieldValidator[] = FIELD_VALIDATORS
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};

  for (const validator of validators) {
    const value = data[validator.field];
    results[validator.field] = validator.validate(value);
  }

  return results;
}

/**
 * Check if at least one name field is present
 * Either first_name or last_name should be provided
 */
export function validateNamePresence(data: {
  first_name?: string;
  last_name?: string;
}): ValidationResult {
  if (!data.first_name && !data.last_name) {
    return {
      valid: false,
      reason: 'Missing both first name and last name',
      suggestion: 'Provide at least first name or last name',
    };
  }

  return { valid: true };
}

/**
 * Custom validation rules for specific fields
 */
export const CUSTOM_VALIDATIONS = {
  /**
   * Validate company size is reasonable
   */
  employee_count: (count: number | null): ValidationResult => {
    if (count === null || count === undefined) {
      return { valid: true }; // Optional field
    }

    if (count < 1) {
      return {
        valid: false,
        reason: 'Invalid employee count',
        suggestion: 'Enter positive number for employee count',
      };
    }

    if (count > 10000000) {
      return {
        valid: false,
        reason: 'Employee count seems unrealistically high',
        suggestion: 'Verify employee count is correct',
      };
    }

    return { valid: true };
  },

  /**
   * Validate annual revenue is reasonable
   */
  annual_revenue: (revenue: number | null): ValidationResult => {
    if (revenue === null || revenue === undefined) {
      return { valid: true }; // Optional field
    }

    if (revenue < 0) {
      return {
        valid: false,
        reason: 'Negative annual revenue',
        suggestion: 'Enter positive number for revenue',
      };
    }

    return { valid: true };
  },
};
