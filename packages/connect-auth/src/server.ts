/**
 * Connect Auth — Server Helpers
 *
 * Read platform-injected identity from trusted proxy headers.
 * These headers are set by the SignalDB apps-proxy after verifying
 * the auth gate cookie. Apps MUST NOT trust these headers from
 * other sources — the proxy strips and re-injects them.
 *
 * Usage (in a server route handler):
 *
 *   import { getUser, requireUser, requireRole } from '@signaldb-live/connect-auth/server';
 *
 *   // Optional auth — returns null if not authenticated
 *   const user = getUser(request.headers);
 *
 *   // Required auth — throws if not authenticated
 *   const user = requireUser(request.headers);
 *
 *   // Role check — throws if user doesn't have one of the required roles
 *   const admin = requireRole(request.headers, 'admin', 'owner');
 */

import type { ConnectUser } from './types';

// Header names injected by the SignalDB apps-proxy
const HEADER_USER_ID = 'X-SignalDB-User-Id';
const HEADER_USER_EMAIL = 'X-SignalDB-User-Email';
const HEADER_USER_ROLES = 'X-SignalDB-User-Roles';
const HEADER_USER_PERMISSIONS = 'X-SignalDB-User-Permissions';
const HEADER_AUTH_VERIFIED = 'X-SignalDB-Auth-Verified';

/**
 * Extract a header value from various header container types.
 * Supports: Headers, plain object, Map, or anything with .get()
 */
function getHeader(headers: any, name: string): string | null {
  if (!headers) return null;

  // Standard Headers object or anything with .get()
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || null;
  }

  // Plain object (e.g., Express req.headers — keys are lowercase)
  if (typeof headers === 'object') {
    return headers[name] || headers[name.toLowerCase()] || null;
  }

  return null;
}

/**
 * Get the authenticated user from platform proxy headers.
 * Returns null if the request is not authenticated.
 */
export function getUser(headers: any): ConnectUser | null {
  const verified = getHeader(headers, HEADER_AUTH_VERIFIED);
  if (verified !== 'true') return null;

  const id = getHeader(headers, HEADER_USER_ID);
  const email = getHeader(headers, HEADER_USER_EMAIL);
  if (!id || !email) return null;

  const role = getHeader(headers, HEADER_USER_ROLES) || 'member';
  const permissionsStr = getHeader(headers, HEADER_USER_PERMISSIONS) || '';
  const permissions = permissionsStr ? permissionsStr.split(',').filter(Boolean) : [];

  return { id, email, role, permissions, authenticated: true };
}

/**
 * Require an authenticated user. Throws if not authenticated.
 */
export function requireUser(headers: any): ConnectUser {
  const user = getUser(headers);
  if (!user) {
    const error = new Error('Authentication required');
    (error as any).status = 401;
    (error as any).code = 'UNAUTHENTICATED';
    throw error;
  }
  return user;
}

/**
 * Require an authenticated user with one of the specified roles.
 * Throws 401 if not authenticated, 403 if wrong role.
 */
export function requireRole(headers: any, ...roles: string[]): ConnectUser {
  const user = requireUser(headers);
  if (!roles.includes(user.role)) {
    const error = new Error(`Required role: ${roles.join(' or ')}. Current role: ${user.role}`);
    (error as any).status = 403;
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
  return user;
}

/**
 * Check if a user has a specific permission.
 * Supports:
 *  - Exact match: 'posts:write' matches 'posts:write'
 *  - Global wildcard: '*' matches everything
 *  - Namespace wildcard: 'posts:*' matches 'posts:write', 'posts:read', etc.
 */
export function hasPermission(user: ConnectUser, permission: string): boolean {
  if (user.permissions.includes('*')) return true;
  if (user.permissions.includes(permission)) return true;
  // Namespace wildcard: user has "posts:*", checking "posts:write"
  for (const p of user.permissions) {
    if (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))) return true;
  }
  return false;
}

/**
 * Require an authenticated user with a specific permission.
 * Throws 401 if not authenticated, 403 if missing permission.
 */
export function requirePermission(headers: any, permission: string): ConnectUser {
  const user = requireUser(headers);
  if (!hasPermission(user, permission)) {
    const error = new Error(`Missing permission: ${permission}`);
    (error as any).status = 403;
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
  return user;
}
