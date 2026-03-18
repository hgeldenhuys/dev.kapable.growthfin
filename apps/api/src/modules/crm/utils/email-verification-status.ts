/**
 * Email Verification Status Mapping Utility
 * Maps technical ZeroBounce status codes to human-readable text
 *
 * Story: CRM-005 - Email Verification Audit Trail
 * Task: T-001
 */

// ZeroBounce status values
export type EmailVerificationStatus = 'valid' | 'invalid' | 'catch-all' | 'unknown' | 'spamtrap' | 'abuse' | 'do_not_mail';

// ZeroBounce subStatus values (reasons for invalid status)
export type EmailVerificationSubStatus =
  | 'antispam_system'
  | 'greylisted'
  | 'mail_server_temporary_error'
  | 'forcible_disconnect'
  | 'mail_server_did_not_respond'
  | 'timeout_exceeded'
  | 'failed_smtp_connection'
  | 'mailbox_quota_exceeded'
  | 'exception_occurred'
  | 'possible_trap'
  | 'role_based'
  | 'global_suppression'
  | 'mailbox_not_found'
  | 'no_dns_entries'
  | 'failed_syntax_check'
  | 'possible_typo'
  | 'unroutable_ip_address'
  | 'leading_period_removed'
  | 'does_not_accept_mail'
  | 'alias_address'
  | 'role_based_catch_all'
  | 'disposable'
  | 'toxic'
  | '';

/**
 * Human-readable status labels
 */
export const EMAIL_STATUS_LABELS: Record<string, string> = {
  valid: 'Valid',
  invalid: 'Invalid',
  'catch-all': 'Catch-All',
  unknown: 'Unknown',
  spamtrap: 'Spam Trap',
  abuse: 'Abuse',
  do_not_mail: 'Do Not Mail',
};

/**
 * Status badge variants for UI styling
 */
export const EMAIL_STATUS_VARIANTS: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  valid: 'default',
  invalid: 'destructive',
  'catch-all': 'secondary',
  unknown: 'outline',
  spamtrap: 'destructive',
  abuse: 'destructive',
  do_not_mail: 'destructive',
};

/**
 * Human-readable subStatus (rejection reason) labels
 */
export const EMAIL_SUBSTATUS_LABELS: Record<string, string> = {
  // Temporary issues
  antispam_system: 'Blocked by anti-spam system',
  greylisted: 'Temporarily greylisted',
  mail_server_temporary_error: 'Mail server temporary error',
  forcible_disconnect: 'Connection forcibly closed',
  mail_server_did_not_respond: 'Mail server did not respond',
  timeout_exceeded: 'Connection timeout',
  failed_smtp_connection: 'SMTP connection failed',
  mailbox_quota_exceeded: 'Mailbox quota exceeded',
  exception_occurred: 'Server exception occurred',

  // Permanent issues
  mailbox_not_found: 'Mailbox does not exist',
  no_dns_entries: 'No DNS records found for domain',
  failed_syntax_check: 'Invalid email format',
  possible_typo: 'Possible typo in email address',
  unroutable_ip_address: 'Unroutable IP address',
  does_not_accept_mail: 'Domain does not accept mail',

  // Risk flags
  possible_trap: 'Possible spam trap',
  role_based: 'Role-based email (e.g., info@, support@)',
  global_suppression: 'On global suppression list',
  alias_address: 'Alias address',
  role_based_catch_all: 'Role-based catch-all',
  disposable: 'Disposable email address',
  toxic: 'Toxic or high-risk domain',

  // Misc
  leading_period_removed: 'Leading period was removed',
  '': 'No additional details',
};

/**
 * SubStatus severity for UI styling
 */
export const EMAIL_SUBSTATUS_SEVERITY: Record<string, 'info' | 'warning' | 'error'> = {
  // Temporary issues (potentially recoverable)
  antispam_system: 'warning',
  greylisted: 'warning',
  mail_server_temporary_error: 'warning',
  forcible_disconnect: 'warning',
  mail_server_did_not_respond: 'warning',
  timeout_exceeded: 'warning',
  failed_smtp_connection: 'warning',
  mailbox_quota_exceeded: 'warning',
  exception_occurred: 'warning',

  // Permanent issues
  mailbox_not_found: 'error',
  no_dns_entries: 'error',
  failed_syntax_check: 'error',
  possible_typo: 'warning',
  unroutable_ip_address: 'error',
  does_not_accept_mail: 'error',

  // Risk flags
  possible_trap: 'error',
  role_based: 'info',
  global_suppression: 'error',
  alias_address: 'info',
  role_based_catch_all: 'info',
  disposable: 'error',
  toxic: 'error',

  // Misc
  leading_period_removed: 'info',
  '': 'info',
};

/**
 * Get human-readable label for status
 */
export function getStatusLabel(status: string): string {
  return EMAIL_STATUS_LABELS[status] || status;
}

/**
 * Get badge variant for status
 */
export function getStatusVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  return EMAIL_STATUS_VARIANTS[status] || 'outline';
}

/**
 * Get human-readable label for subStatus
 */
export function getSubStatusLabel(subStatus: string): string {
  return EMAIL_SUBSTATUS_LABELS[subStatus] || subStatus || 'Unknown reason';
}

/**
 * Get severity level for subStatus
 */
export function getSubStatusSeverity(subStatus: string): 'info' | 'warning' | 'error' {
  return EMAIL_SUBSTATUS_SEVERITY[subStatus] || 'info';
}

/**
 * Format MX validation info for display
 */
export function formatMxInfo(mxFound: boolean | null, mxRecord: string | null, smtpProvider: string | null): string {
  if (mxFound === null || mxFound === undefined) {
    return 'MX validation not performed';
  }

  if (!mxFound) {
    return 'No MX records found';
  }

  const parts: string[] = ['MX records found'];

  if (mxRecord) {
    parts.push(`Record: ${mxRecord}`);
  }

  if (smtpProvider) {
    parts.push(`Provider: ${smtpProvider}`);
  }

  return parts.join(' | ');
}

/**
 * Email verification result interface (from ZeroBounce)
 */
export interface EmailVerificationResult {
  email: string;
  status: string;
  subStatus: string;
  mxFound: boolean;
  mxRecord: string;
  smtpProvider: string;
  domain: string;
  account: string;
  freeEmail: boolean;
  processedAt: string;
  cached?: boolean;
  // Optional person data
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  zipcode?: string | null;
  didYouMean?: string | null;
}

/**
 * Parsed email verification attempt for UI display
 */
export interface ParsedEmailAttempt {
  id: string;
  email: string;
  status: string;
  statusLabel: string;
  statusVariant: 'default' | 'destructive' | 'secondary' | 'outline';
  subStatus: string;
  subStatusLabel: string;
  subStatusSeverity: 'info' | 'warning' | 'error';
  mxFound: boolean;
  mxRecord: string;
  smtpProvider: string;
  mxInfo: string;
  domain: string;
  isValid: boolean;
  processedAt: string;
  suggestion: string | null;
}

/**
 * Parse raw tool call result into display-ready format
 */
export function parseEmailVerificationResult(
  id: string,
  result: EmailVerificationResult
): ParsedEmailAttempt {
  return {
    id,
    email: result.email,
    status: result.status,
    statusLabel: getStatusLabel(result.status),
    statusVariant: getStatusVariant(result.status),
    subStatus: result.subStatus || '',
    subStatusLabel: getSubStatusLabel(result.subStatus),
    subStatusSeverity: getSubStatusSeverity(result.subStatus),
    mxFound: result.mxFound,
    mxRecord: result.mxRecord || '',
    smtpProvider: result.smtpProvider || '',
    mxInfo: formatMxInfo(result.mxFound, result.mxRecord, result.smtpProvider),
    domain: result.domain,
    isValid: result.status === 'valid',
    processedAt: result.processedAt,
    suggestion: result.didYouMean || null,
  };
}
