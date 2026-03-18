/**
 * Authentication Utilities
 *
 * Helpers for working with SignalDB authentication
 */

/**
 * Parse a JWT token without verification
 * Useful for extracting claims client-side
 */
export function parseToken(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const parsed = parseToken(token);
  if (!parsed) return true;

  const exp = parsed.payload.exp;
  if (typeof exp !== 'number') return true;

  // Add 60 second buffer
  return Date.now() >= (exp * 1000) - 60000;
}

/**
 * Get time until token expires (in seconds)
 * Returns 0 if token is expired or invalid
 */
export function getTokenTimeRemaining(token: string): number {
  const parsed = parseToken(token);
  if (!parsed) return 0;

  const exp = parsed.payload.exp;
  if (typeof exp !== 'number') return 0;

  const remaining = (exp * 1000) - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Get user ID (sub claim) from token
 */
export function getTokenUserId(token: string): string | null {
  const parsed = parseToken(token);
  if (!parsed) return null;

  const sub = parsed.payload.sub;
  return typeof sub === 'string' ? sub : null;
}

/**
 * Get scopes from token
 */
export function getTokenScopes(token: string): Record<string, unknown> | null {
  const parsed = parseToken(token);
  if (!parsed) return null;

  const scopes = parsed.payload.scopes;
  return typeof scopes === 'object' && scopes !== null ? scopes as Record<string, unknown> : null;
}

/**
 * Get project ID from token
 */
export function getTokenProjectId(token: string): string | null {
  const parsed = parseToken(token);
  if (!parsed) return null;

  const pid = parsed.payload.pid;
  return typeof pid === 'string' ? pid : null;
}

/**
 * Verify HMAC-SHA256 webhook signature
 * Use this to verify webhook payloads in your server
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Extract the hash from signature (format: sha256=xxxx)
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const receivedHash = signature.slice(7);

  // Compute expected hash
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const expectedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expectedHash.length !== receivedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    result |= expectedHash.charCodeAt(i) ^ receivedHash.charCodeAt(i);
  }

  return result === 0;
}
