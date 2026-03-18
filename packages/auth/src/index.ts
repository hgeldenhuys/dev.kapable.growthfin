/**
 * @signaldb/auth - SignalDB Authentication Client
 *
 * A client library for authenticating users with SignalDB-powered applications.
 * Automatically detects the correct auth endpoint based on domain.
 *
 * @example
 * ```typescript
 * import { createAuthClient } from '@signaldb/auth';
 *
 * const auth = createAuthClient({
 *   orgSlug: 'myorg',
 *   projectSlug: 'myproject',
 * });
 *
 * // Login
 * const { user, token } = await auth.login('user@example.com', 'password');
 *
 * // Get current session
 * const session = await auth.getSession();
 *
 * // Logout
 * await auth.logout();
 * ```
 */

export interface AuthClientConfig {
  /** Organization slug */
  orgSlug: string;
  /** Project slug */
  projectSlug: string;
  /** Override the auth base URL (optional, auto-detected by default) */
  baseUrl?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  email_verified: boolean;
}

export interface AuthResult {
  user: User;
  token: string;
  expires_at: string;
}

export interface SessionResult {
  user: User;
  token: string;
  expires_at: string;
}

export interface AuthError {
  error: string;
  code?: string;
}

/**
 * Detect the appropriate auth base URL based on current domain
 */
function detectAuthBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: default to .live
    return 'https://auth.signaldb.live';
  }

  const host = window.location.hostname;

  // If on .signaldb.app domain, use auth.signaldb.app
  if (host.endsWith('.signaldb.app') || host === 'signaldb.app') {
    return 'https://auth.signaldb.app';
  }

  // Otherwise use .live (platform, localhost, etc.)
  return 'https://auth.signaldb.live';
}

/**
 * SignalDB Authentication Client
 */
export class AuthClient {
  private baseUrl: string;
  private orgSlug: string;
  private projectSlug: string;

  constructor(config: AuthClientConfig) {
    this.orgSlug = config.orgSlug;
    this.projectSlug = config.projectSlug;
    this.baseUrl = config.baseUrl || detectAuthBaseUrl();
  }

  /**
   * Get the API URL for auth endpoints
   */
  private getApiUrl(endpoint: string): string {
    return `${this.baseUrl}/api/${this.orgSlug}/${this.projectSlug}${endpoint}`;
  }

  /**
   * Sign up a new user
   */
  async signup(email: string, password: string, name?: string): Promise<AuthResult> {
    const response = await fetch(this.getApiUrl('/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Log in an existing user
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const response = await fetch(this.getApiUrl('/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    const response = await fetch(this.getApiUrl('/logout'), {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }
  }

  /**
   * Get the current session (refresh JWT from session cookie)
   */
  async getSession(): Promise<SessionResult | null> {
    const response = await fetch(this.getApiUrl('/session'), {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Request a password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(this.getApiUrl('/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(this.getApiUrl('/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: newPassword }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await fetch(this.getApiUrl('/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }
  }

  /**
   * Get the hosted login page URL
   */
  getLoginUrl(redirectUrl?: string): string {
    const url = `${this.baseUrl}/${this.orgSlug}/${this.projectSlug}/login`;
    if (redirectUrl) {
      return `${url}?redirect=${encodeURIComponent(redirectUrl)}`;
    }
    return url;
  }

  /**
   * Get the hosted signup page URL
   */
  getSignupUrl(redirectUrl?: string): string {
    const url = `${this.baseUrl}/${this.orgSlug}/${this.projectSlug}/signup`;
    if (redirectUrl) {
      return `${url}?redirect=${encodeURIComponent(redirectUrl)}`;
    }
    return url;
  }

  /**
   * Initiate OAuth login
   */
  initiateOAuth(provider: string, redirectUrl?: string): void {
    let url = `${this.baseUrl}/api/${this.orgSlug}/${this.projectSlug}/oauth/${provider}`;
    if (redirectUrl) {
      url += `?redirect=${encodeURIComponent(redirectUrl)}`;
    }
    window.location.href = url;
  }

  // ===========================================================
  // New auth methods (BetterAuth engine)
  // ===========================================================

  /**
   * Send a magic link email
   */
  async sendMagicLink(email: string, redirectUrl?: string): Promise<void> {
    const response = await fetch(this.getApiUrl('/magic-link/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectUrl }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }
  }

  /**
   * Verify a magic link token
   */
  async verifyMagicLink(token: string): Promise<AuthResult> {
    const response = await fetch(this.getApiUrl('/magic-link/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Send an email OTP
   */
  async sendEmailOtp(email: string): Promise<void> {
    const response = await fetch(this.getApiUrl('/email-otp/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }
  }

  /**
   * Verify an email OTP
   */
  async verifyEmailOtp(email: string, otp: string): Promise<AuthResult> {
    const response = await fetch(this.getApiUrl('/email-otp/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Enable two-factor authentication (returns TOTP URI and backup codes)
   */
  async enableTwoFactor(sessionToken: string): Promise<{ totpUri: string; backupCodes: string[] }> {
    const response = await fetch(this.getApiUrl('/2fa/enable'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Verify a TOTP code during 2FA login
   */
  async verifyTwoFactor(code: string, trustDevice?: boolean): Promise<AuthResult> {
    const response = await fetch(this.getApiUrl('/2fa/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, trustDevice }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Verify using a backup code during 2FA login
   */
  async verifyBackupCode(backupCode: string): Promise<AuthResult> {
    const response = await fetch(this.getApiUrl('/2fa/backup-codes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ backupCode }),
    });

    if (!response.ok) {
      const error: AuthError = await response.json();
      throw new AuthClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Get the published theme config for this project
   */
  async getTheme(): Promise<Record<string, any>> {
    const response = await fetch(this.getApiUrl('/theme'), {
      method: 'GET',
    });

    if (!response.ok) return {};
    return response.json();
  }
}

/**
 * Error thrown by auth client operations
 */
export class AuthClientError extends Error {
  code?: string;
  status: number;

  constructor(message: string, code?: string, status: number = 400) {
    super(message);
    this.name = 'AuthClientError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Create an auth client instance
 */
export function createAuthClient(config: AuthClientConfig): AuthClient {
  return new AuthClient(config);
}

// Re-export types
export type { AuthClientConfig as SignalDBAuthConfig };
export type { ThemeConfig } from './widget-types';
