/**
 * Lightweight Error Tracking
 *
 * Records error events in the database with SHA256 fingerprinting.
 * Upserts on fingerprint conflict to increment count.
 */

import { sql } from './db';

/**
 * Generate a fingerprint for error deduplication
 */
function generateFingerprint(errorType: string, path: string, firstStackLine: string): string {
  const input = `${errorType}:${path}:${firstStackLine}`;
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(input);
  return hasher.digest('hex');
}

/**
 * Track an error event. Non-blocking (fire-and-forget).
 */
export function trackError(
  error: Error | unknown,
  context: { path?: string; method?: string; orgId?: string } = {}
): void {
  // Fire and forget
  _trackError(error, context).catch((err) => {
    console.error('[error-tracking] Failed to track error:', err);
  });
}

async function _trackError(
  error: Error | unknown,
  context: { path?: string; method?: string; orgId?: string }
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const errorType = err.name || 'UnknownError';
  const message = err.message || 'Unknown error';
  const stackTrace = err.stack || null;
  const requestPath = context.path || 'unknown';

  // Get first meaningful stack line for fingerprinting
  const firstStackLine = stackTrace
    ? (stackTrace.split('\n').find(line => line.trim().startsWith('at ')) || '').trim()
    : '';

  const fingerprint = generateFingerprint(errorType, requestPath, firstStackLine);

  await sql`
    INSERT INTO error_events (fingerprint, error_type, message, stack_trace, request_path, org_id, count, first_seen, last_seen)
    VALUES (
      ${fingerprint},
      ${errorType},
      ${message.slice(0, 2000)},
      ${stackTrace ? stackTrace.slice(0, 10000) : null},
      ${requestPath},
      ${context.orgId || null},
      1,
      now(),
      now()
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
      count = error_events.count + 1,
      last_seen = now(),
      message = EXCLUDED.message,
      stack_trace = COALESCE(EXCLUDED.stack_trace, error_events.stack_trace)
  `;
}

/**
 * Get recent error events
 */
export async function getRecentErrors(hours: number = 24, limit: number = 50): Promise<Array<{
  id: string;
  fingerprint: string;
  error_type: string;
  message: string;
  request_path: string | null;
  count: number;
  first_seen: Date;
  last_seen: Date;
}>> {
  try {
    const rows = await sql`
      SELECT id, fingerprint, error_type, message, request_path, count, first_seen, last_seen
      FROM error_events
      WHERE last_seen > now() - ${hours + ' hours'}::interval
      ORDER BY last_seen DESC
      LIMIT ${limit}
    `;
    return rows as any[];
  } catch {
    return [];
  }
}
