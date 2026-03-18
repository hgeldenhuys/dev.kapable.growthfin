/**
 * Connect Auth — React Hooks
 *
 * Client-side auth hooks for Connect apps. Fetches identity from
 * the platform's /__auth/me endpoint (which reads the gate cookie).
 *
 * Usage:
 *
 *   import { useConnectAuth, ConnectAuthProvider } from '@signaldb-live/connect-auth/react';
 *
 *   // Wrap your app (optional — for global context)
 *   <ConnectAuthProvider>
 *     <App />
 *   </ConnectAuthProvider>
 *
 *   // In any component
 *   const { user, loading, isAuthenticated, logout } = useConnectAuth();
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import type { ConnectUser, ConnectAuthState } from './types';

interface ConnectAuthContextValue extends ConnectAuthState {
  /** Redirect to /__auth/logout to clear the gate cookie */
  logout: () => void;
  /** Re-fetch /__auth/me to refresh user state */
  refresh: () => Promise<void>;
  /** Check if the current user has a specific permission */
  hasPermission: (permission: string) => boolean;
}

const ConnectAuthContext = createContext<ConnectAuthContextValue | null>(null);

/**
 * Fetch user identity from the platform's /__auth/me endpoint.
 */
async function fetchAuthMe(): Promise<{ user: ConnectUser | null; authenticated: boolean; expiresAt: number | null }> {
  try {
    const res = await fetch('/__auth/me', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return { user: null, authenticated: false, expiresAt: null };
    const data = await res.json();
    if (data.authenticated && data.user) {
      return {
        user: {
          ...data.user,
          permissions: data.user.permissions || [],
          authenticated: true,
        } as ConnectUser,
        authenticated: true,
        expiresAt: data.expiresAt ?? null,
      };
    }
    return { user: null, authenticated: false, expiresAt: null };
  } catch {
    return { user: null, authenticated: false, expiresAt: null };
  }
}

/**
 * Silently refresh the gate token by calling POST /__auth/refresh,
 * then re-fetch /__auth/me to get the new expiresAt.
 * Returns the new state, or null if refresh failed (token expired).
 */
async function silentRefresh(): Promise<{ user: ConnectUser | null; authenticated: boolean; expiresAt: number | null } | null> {
  try {
    const res = await fetch('/__auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    // Re-fetch to get updated expiresAt + user data
    return await fetchAuthMe();
  } catch {
    return null;
  }
}

/**
 * Hook that schedules auto-refresh 2 minutes before token expiry.
 */
function useAutoRefresh(
  expiresAt: number | null,
  authenticated: boolean,
  onRefreshed: (result: { user: ConnectUser | null; authenticated: boolean; expiresAt: number | null }) => void,
  onExpired: () => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!authenticated || !expiresAt) return;

    const now = Date.now();
    // Refresh 2 minutes before expiry (120_000ms)
    const refreshAt = expiresAt - 120_000;
    const delay = Math.max(refreshAt - now, 0);

    timerRef.current = setTimeout(async () => {
      const result = await silentRefresh();
      if (result && result.authenticated) {
        onRefreshed(result);
      } else {
        onExpired();
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [expiresAt, authenticated, onRefreshed, onExpired]);
}

/**
 * React hook for Connect app authentication.
 * Fetches identity from /__auth/me on mount.
 * Auto-refreshes the gate token 2 minutes before expiry.
 * Can be used standalone or within ConnectAuthProvider.
 */
export function useConnectAuth(): ConnectAuthContextValue {
  const ctx = useContext(ConnectAuthContext);
  if (ctx) return ctx;

  // Standalone usage (no provider)
  const [state, setState] = useState<ConnectAuthState>({
    user: null,
    authenticated: false,
    loading: true,
    expiresAt: null,
  });

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    const result = await fetchAuthMe();
    setState({ ...result, loading: false });
  }, []);

  const logout = useCallback(() => {
    window.location.href = '/__auth/logout';
  }, []);

  const onRefreshed = useCallback((result: { user: ConnectUser | null; authenticated: boolean; expiresAt: number | null }) => {
    setState({ ...result, loading: false });
  }, []);

  const onExpired = useCallback(() => {
    setState({ user: null, authenticated: false, loading: false, expiresAt: null });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkPermission = useCallback((permission: string): boolean => {
    if (!state.user) return false;
    if (state.user.permissions.includes('*')) return true;
    if (state.user.permissions.includes(permission)) return true;
    for (const p of state.user.permissions) {
      if (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))) return true;
    }
    return false;
  }, [state.user]);

  useAutoRefresh(state.expiresAt, state.authenticated, onRefreshed, onExpired);

  return { ...state, logout, refresh, hasPermission: checkPermission };
}

/**
 * Provider for Connect auth context. Fetches identity once and
 * shares it with all descendants via useConnectAuth().
 * Auto-refreshes the gate token 2 minutes before expiry.
 */
export function ConnectAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectAuthState>({
    user: null,
    authenticated: false,
    loading: true,
    expiresAt: null,
  });

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    const result = await fetchAuthMe();
    setState({ ...result, loading: false });
  }, []);

  const logout = useCallback(() => {
    window.location.href = '/__auth/logout';
  }, []);

  const onRefreshed = useCallback((result: { user: ConnectUser | null; authenticated: boolean; expiresAt: number | null }) => {
    setState({ ...result, loading: false });
  }, []);

  const onExpired = useCallback(() => {
    setState({ user: null, authenticated: false, loading: false, expiresAt: null });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkPermission = useCallback((permission: string): boolean => {
    if (!state.user) return false;
    if (state.user.permissions.includes('*')) return true;
    if (state.user.permissions.includes(permission)) return true;
    for (const p of state.user.permissions) {
      if (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))) return true;
    }
    return false;
  }, [state.user]);

  useAutoRefresh(state.expiresAt, state.authenticated, onRefreshed, onExpired);

  const value: ConnectAuthContextValue = { ...state, logout, refresh, hasPermission: checkPermission };

  return (
    <ConnectAuthContext.Provider value={value}>
      {children}
    </ConnectAuthContext.Provider>
  );
}

export type { ConnectUser, ConnectAuthState };
