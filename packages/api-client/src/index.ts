/**
 * Agios API Client
 * Type-safe client generated from OpenAPI spec
 */

import { createConfig } from './generated/client';
import { createClient as createHeyApiClient } from './generated/client';
export * from './generated';

// Re-export client for direct usage
export { client } from './generated/client.gen';

/**
 * Create a configured API client
 * @param baseUrl - API base URL (defaults to http://localhost:3000)
 */
export function createClient(baseUrl: string = 'http://localhost:3000') {
  return createHeyApiClient(createConfig({
    baseUrl,
  }));
}

/**
 * Auth API
 * Better Auth endpoints (not in OpenAPI spec, so we define them manually)
 */
export const auth = {
  /**
   * Sign in with email and password
   */
  async signIn(
    email: string,
    password: string,
    options?: { baseUrl?: string }
  ) {
    const baseUrl = options?.baseUrl || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Authentication failed' }));
      throw new Error(error.message || 'Authentication failed');
    }

    return response.json();
  },

  /**
   * Sign up with email and password
   */
  async signUp(
    email: string,
    password: string,
    name?: string,
    options?: { baseUrl?: string }
  ) {
    const baseUrl = options?.baseUrl || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Sign up failed' }));
      throw new Error(error.message || 'Sign up failed');
    }

    return response.json();
  },

  /**
   * Sign out
   */
  async signOut(options?: { baseUrl?: string }) {
    const baseUrl = options?.baseUrl || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Sign out failed');
    }

    return response.json();
  },

  /**
   * Get current session
   */
  async getSession(options?: { baseUrl?: string; headers?: HeadersInit }) {
    const baseUrl = options?.baseUrl || 'http://localhost:3000';
    const headers: HeadersInit = {
      ...(options?.headers || {}),
    };

    console.log('[API CLIENT] getSession called');
    console.log('[API CLIENT] Headers:', headers);
    console.log('[API CLIENT] BaseURL:', baseUrl);

    const response = await fetch(`${baseUrl}/auth/session`, {
      method: 'GET',
      credentials: 'include',
      headers,
    });

    console.log('[API CLIENT] Response status:', response.status);
    console.log('[API CLIENT] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.log('[API CLIENT] Session check failed');
      return null;
    }

    const data = await response.json();
    console.log('[API CLIENT] Session data:', data);
    return data;
  },
};
