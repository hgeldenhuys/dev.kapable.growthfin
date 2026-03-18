/**
 * Connect Auth — Shared Types
 *
 * Types for platform-provided identity in SignalDB Connect apps.
 * Identity comes from trusted proxy headers (X-SignalDB-User-*),
 * NOT from JWTs or direct auth — the platform proxy injects these
 * after verifying the auth gate cookie.
 */

export interface ConnectUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  authenticated: true;
}

export interface ConnectAuthState {
  user: ConnectUser | null;
  authenticated: boolean;
  loading: boolean;
  expiresAt: number | null;
}
