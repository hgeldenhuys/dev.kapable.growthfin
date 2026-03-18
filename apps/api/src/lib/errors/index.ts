/**
 * Error handling utilities
 *
 * Centralized error handling with SemanticError for structured error context.
 */

export {
  SemanticError,
  ErrorCode,
  isSemanticError,
  wrapError,
  isTwilioErrorRecoverable,
  mapTwilioError,
} from './semantic-error';
