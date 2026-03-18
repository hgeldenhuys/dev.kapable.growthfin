/**
 * Financial Analysis Input Validation
 * Validates balance sheet text input before LLM processing
 */

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate balance sheet input text
 *
 * @param text - User-provided balance sheet text
 * @returns Validation result with error details if invalid
 */
export function validateBalanceSheetInput(text: string): ValidationResult {
  // Check for empty or whitespace-only text
  if (!text || text.trim().length === 0) {
    return {
      valid: false,
      error: {
        code: 'EMPTY_TEXT',
        message: 'Balance sheet text cannot be empty',
      },
    };
  }

  // Check for text exceeding maximum length (50,000 chars)
  if (text.length > 50000) {
    return {
      valid: false,
      error: {
        code: 'TEXT_TOO_LONG',
        message: `Balance sheet text exceeds maximum length of 50,000 characters (got ${text.length})`,
      },
    };
  }

  // Validation passed
  return { valid: true };
}
