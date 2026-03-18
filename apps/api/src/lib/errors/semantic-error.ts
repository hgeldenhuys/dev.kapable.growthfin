/**
 * SemanticError - Structured error with full causal context
 *
 * Provides backward traceability for production debugging by preserving:
 * - Machine-readable error codes
 * - Full context for causal analysis
 * - Original error cause (causal chain)
 * - Recoverability metadata for retry logic
 *
 * Usage (Boy Scout Rule - adopt gradually):
 * When you touch error handling code, upgrade it to use SemanticError.
 *
 * @example
 * ```typescript
 * // Before
 * catch (error) {
 *   return { success: false, error: error.message };
 * }
 *
 * // After (when you touch this code)
 * catch (error) {
 *   throw new SemanticError(
 *     ErrorCode.SMS_SEND_FAILED,
 *     'Failed to send SMS via Twilio',
 *     { recipientId, campaignId, twilioErrorCode: error.code },
 *     error,
 *     isRecoverableError(error.code)
 *   );
 * }
 * ```
 */

/**
 * Centralized error codes for the entire application
 *
 * Naming convention: [DOMAIN]_[ACTION]_[OUTCOME]
 * - DOMAIN: SMS, VOICE, WHATSAPP, EMAIL, DATABASE, etc.
 * - ACTION: SEND, FETCH, VALIDATE, etc.
 * - OUTCOME: FAILED, INVALID, MISSING, etc.
 *
 * Add new codes as you encounter errors in the codebase.
 */
export enum ErrorCode {
  // Validation errors
  PHONE_FORMAT_INVALID = 'PHONE_FORMAT_INVALID',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  INVALID_PARAMETER = 'INVALID_PARAMETER',

  // SMS channel errors
  SMS_SEND_FAILED = 'SMS_SEND_FAILED',
  SMS_VALIDATION_FAILED = 'SMS_VALIDATION_FAILED',

  // Voice channel errors
  VOICE_CALL_FAILED = 'VOICE_CALL_FAILED',
  VOICE_TWIML_GENERATION_FAILED = 'VOICE_TWIML_GENERATION_FAILED',
  VOICE_INVALID_OPTIONS = 'VOICE_INVALID_OPTIONS',

  // WhatsApp channel errors
  WHATSAPP_SEND_FAILED = 'WHATSAPP_SEND_FAILED',
  WHATSAPP_TEMPLATE_INVALID = 'WHATSAPP_TEMPLATE_INVALID',
  WHATSAPP_MEDIA_INVALID = 'WHATSAPP_MEDIA_INVALID',

  // Email channel errors
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  EMAIL_TEMPLATE_INVALID = 'EMAIL_TEMPLATE_INVALID',

  // Twilio API errors
  TWILIO_RATE_LIMIT = 'TWILIO_RATE_LIMIT',
  TWILIO_AUTH_FAILED = 'TWILIO_AUTH_FAILED',
  TWILIO_INVALID_PARAMS = 'TWILIO_INVALID_PARAMS',
  TWILIO_QUEUE_OVERFLOW = 'TWILIO_QUEUE_OVERFLOW',
  TWILIO_UNREACHABLE_RECIPIENT = 'TWILIO_UNREACHABLE_RECIPIENT',

  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',

  // System errors
  QUEUE_OVERFLOW = 'QUEUE_OVERFLOW',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONFIGURATION_MISSING = 'CONFIGURATION_MISSING',

  // Catch-all
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * SemanticError class with full causal context
 *
 * Extends native Error with structured data for backward tracing.
 * Designed for gradual adoption - can coexist with regular Error handling.
 */
export class SemanticError extends Error {
  /** Machine-readable error code for programmatic handling */
  public readonly code: ErrorCode;

  /** Structured context for backward causal tracing */
  public readonly context: Record<string, any>;

  /** Original error that caused this (preserves causal chain) */
  public readonly cause?: Error;

  /** When this error occurred */
  public readonly occurredAt: Date;

  /** Whether this error can be recovered from (retry logic) */
  public readonly recoverable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    context: Record<string, any> = {},
    cause?: Error,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'SemanticError';
    this.code = code;
    this.context = context;
    this.cause = cause;
    this.occurredAt = new Date();
    this.recoverable = recoverable;

    // Maintain proper stack trace
    Error.captureStackTrace(this, SemanticError);
  }

  /**
   * Serialize to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      occurredAt: this.occurredAt,
      recoverable: this.recoverable,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
      stack: this.stack,
    };
  }

  /**
   * Get full context including error metadata
   * Useful for analytics and root cause analysis
   */
  getFullContext(): Record<string, any> {
    return {
      ...this.context,
      errorCode: this.code,
      errorMessage: this.message,
      occurredAt: this.occurredAt,
      recoverable: this.recoverable,
      originalError: this.cause?.message,
      originalErrorName: this.cause?.name,
    };
  }

  /**
   * Check if this error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoverable;
  }

  /**
   * Get a user-friendly error message (safe to show to users)
   */
  getUserMessage(): string {
    // Map error codes to user-friendly messages
    const userMessages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.PHONE_FORMAT_INVALID]:
        'The phone number format is invalid. Please use international format (e.g., +1234567890).',
      [ErrorCode.REQUIRED_FIELD_MISSING]: 'A required field is missing. Please check your input.',
      [ErrorCode.SMS_SEND_FAILED]:
        'Failed to send SMS message. Please try again later.',
      [ErrorCode.TWILIO_RATE_LIMIT]:
        'Too many messages sent. Please wait a moment and try again.',
      [ErrorCode.DATABASE_CONNECTION_FAILED]:
        'Database connection issue. Please try again later.',
    };

    return userMessages[this.code] || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Type guard to check if an error is a SemanticError
 */
export function isSemanticError(error: unknown): error is SemanticError {
  return error instanceof SemanticError;
}

/**
 * Helper to wrap unknown errors in SemanticError
 * Useful for catch blocks that might receive any error type
 */
export function wrapError(
  error: unknown,
  code: ErrorCode,
  context: Record<string, any> = {}
): SemanticError {
  if (error instanceof SemanticError) {
    return error;
  }

  if (error instanceof Error) {
    return new SemanticError(code, error.message, context, error);
  }

  return new SemanticError(
    code,
    String(error),
    { ...context, originalError: error },
    undefined
  );
}

/**
 * Helper to determine if a Twilio error is recoverable
 * Add more error codes as you discover them
 */
export function isTwilioErrorRecoverable(twilioErrorCode: number): boolean {
  const recoverableCodes = [
    30001, // Queue overflow - retry later
    30006, // Landline/unreachable - skip recipient
    20429, // Rate limit - throttle and retry
    21211, // Invalid 'To' Number - fix number format
  ];
  return recoverableCodes.includes(twilioErrorCode);
}

/**
 * Map Twilio error codes to SemanticError codes
 * Add mappings as you encounter Twilio errors
 */
export function mapTwilioError(twilioErrorCode: number): ErrorCode {
  const errorCodeMap: Record<number, ErrorCode> = {
    30001: ErrorCode.TWILIO_QUEUE_OVERFLOW,
    30006: ErrorCode.TWILIO_UNREACHABLE_RECIPIENT,
    20429: ErrorCode.TWILIO_RATE_LIMIT,
    20003: ErrorCode.TWILIO_AUTH_FAILED,
    21211: ErrorCode.PHONE_FORMAT_INVALID,
    21612: ErrorCode.TWILIO_INVALID_PARAMS,
  };

  return errorCodeMap[twilioErrorCode] || ErrorCode.UNKNOWN_ERROR;
}
