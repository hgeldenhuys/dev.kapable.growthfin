/**
 * JWT Utilities for Scoped Tokens
 *
 * Uses jose library for secure JWT operations
 */

import * as jose from 'jose';
import { nanoid } from 'nanoid';
import type { ScopedTokenPayload, CreateTokenRequest, TokenClaims } from '../types';

/**
 * Generate a unique JWT ID (jti)
 */
export function generateJti(): string {
  return `tok_${nanoid(24)}`;
}

/**
 * Sign a scoped token JWT
 *
 * @param projectId - The project ID (included as 'pid' claim)
 * @param secret - The project's JWT secret
 * @param payload - Token payload with sub, scopes, and expiry info
 * @returns Signed JWT string
 */
export async function signToken(
  projectId: string,
  secret: string,
  payload: CreateTokenRequest
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti = generateJti();
  const secretKey = new TextEncoder().encode(secret);

  // Default expiry: 24 hours, max: 30 days
  const expiresIn = Math.min(payload.expires_in || 86400, 30 * 24 * 60 * 60);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const claims: TokenClaims = {
    iss: 'signaldb',
    pid: projectId,
    sub: payload.sub,
    jti,
    scopes: payload.scopes || {},
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const token = await new jose.SignJWT(claims as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey);

  return { token, jti, expiresAt };
}

/**
 * Verify a scoped token JWT
 *
 * @param token - The JWT string
 * @param secret - The project's JWT secret
 * @returns Decoded token claims or null if invalid
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenClaims | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey, {
      issuer: 'signaldb',
    });

    // Validate required claims
    if (!payload.pid || !payload.jti) {
      return null;
    }

    return {
      iss: payload.iss as string,
      pid: payload.pid as string,
      sub: payload.sub as string | undefined,
      jti: payload.jti as string,
      scopes: (payload.scopes as Record<string, unknown>) || {},
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    // Token is invalid (expired, bad signature, etc.)
    return null;
  }
}

/**
 * Decode a token without verification (for inspection only)
 *
 * @param token - The JWT string
 * @returns Decoded payload or null if malformed
 */
export function decodeToken(token: string): TokenClaims | null {
  try {
    const payload = jose.decodeJwt(token);

    return {
      iss: payload.iss as string,
      pid: payload.pid as string,
      sub: payload.sub as string | undefined,
      jti: payload.jti as string,
      scopes: (payload.scopes as Record<string, unknown>) || {},
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/**
 * Extract project ID from token without full verification
 * Useful for routing to the correct project before verification
 */
export function extractProjectId(token: string): string | null {
  const decoded = decodeToken(token);
  return decoded?.pid || null;
}

/**
 * Check if a token has been revoked
 *
 * @param jti - The JWT ID (unique token identifier)
 * @param projectSql - Database connection for the project
 * @param schema - Schema name for hobbyist tier (null for pro/enterprise)
 * @returns true if the token is revoked, false otherwise
 */
export async function isTokenRevoked(
  jti: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectSql: any,
  schema: string | null
): Promise<boolean> {
  // Auth-issued tokens (from auth.signaldb.live) are validated by session,
  // not the _tokens revocation table
  if (jti.startsWith('auth_')) return false;

  const tokensRef = schema ? `"${schema}"."_tokens"` : '"_tokens"';

  try {
    const result = await projectSql.unsafe(
      `SELECT revoked_at, expires_at FROM ${tokensRef} WHERE jti = $1`,
      [jti]
    ) as Array<{ revoked_at: Date | null; expires_at: Date }>;

    // Token not found in database - reject it
    if (result.length === 0) {
      return true;
    }

    const token = result[0];

    // Check if explicitly revoked
    if (token.revoked_at !== null) {
      return true;
    }

    // Check if expired (belt-and-suspenders with JWT exp claim)
    if (new Date() > new Date(token.expires_at)) {
      return true;
    }

    return false;
  } catch (error) {
    // If table doesn't exist or query fails, reject the token
    console.error('[jwt] Error checking token revocation:', error);
    return true;
  }
}
