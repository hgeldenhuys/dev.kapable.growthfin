/**
 * @signaldb/auth/react - React bindings for SignalDB Authentication
 *
 * Provides React hooks and context for managing authentication state.
 *
 * @example
 * ```tsx
 * import { AuthProvider, useAuth } from '@signaldb/auth/react';
 *
 * function App() {
 *   return (
 *     <AuthProvider orgSlug="myorg" projectSlug="myproject">
 *       <MyApp />
 *     </AuthProvider>
 *   );
 * }
 *
 * function MyApp() {
 *   const { user, isLoading, login, logout } = useAuth();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!user) return <LoginForm onLogin={login} />;
 *
 *   return (
 *     <div>
 *       <p>Hello, {user.email}!</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import {
  AuthClient,
  createAuthClient,
  type AuthClientConfig,
  type User,
  type AuthResult,
  AuthClientError,
} from './index';

// Re-export from main module
export { AuthClientError } from './index';
export type { User, AuthResult, AuthClientConfig } from './index';

/**
 * Auth context state
 */
export interface AuthState {
  /** Current user (null if not authenticated) */
  user: User | null;
  /** Current JWT token (null if not authenticated) */
  token: string | null;
  /** Token expiration time */
  expiresAt: Date | null;
  /** Whether auth state is being loaded */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Last error (if any) */
  error: Error | null;
}

/**
 * Auth context actions
 */
export interface AuthActions {
  /** Sign up a new user */
  signup: (email: string, password: string, name?: string) => Promise<AuthResult>;
  /** Log in an existing user */
  login: (email: string, password: string) => Promise<AuthResult>;
  /** Log out the current user */
  logout: () => Promise<void>;
  /** Refresh the session */
  refreshSession: () => Promise<void>;
  /** Clear any error */
  clearError: () => void;
  /** Get the auth client instance */
  getClient: () => AuthClient;
}

export type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider props
 */
export interface AuthProviderProps extends AuthClientConfig {
  children: ReactNode;
  /**
   * Whether to automatically refresh the session on mount
   * @default true
   */
  autoRefresh?: boolean;
  /**
   * Interval in ms to refresh session (0 to disable)
   * @default 0 (disabled)
   */
  refreshInterval?: number;
  /**
   * Callback when auth state changes
   */
  onAuthChange?: (state: AuthState) => void;
}

/**
 * Auth provider component
 *
 * Wrap your app with this provider to enable authentication.
 */
export function AuthProvider({
  children,
  orgSlug,
  projectSlug,
  baseUrl,
  autoRefresh = true,
  refreshInterval = 0,
  onAuthChange,
}: AuthProviderProps) {
  const client = useMemo(
    () => createAuthClient({ orgSlug, projectSlug, baseUrl }),
    [orgSlug, projectSlug, baseUrl]
  );

  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    expiresAt: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Update callback when state changes
  useEffect(() => {
    if (onAuthChange) {
      onAuthChange(state);
    }
  }, [state, onAuthChange]);

  const refreshSession = useCallback(async () => {
    try {
      const session = await client.getSession();

      if (session) {
        setState({
          user: session.user,
          token: session.token,
          expiresAt: new Date(session.expires_at),
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        setState({
          user: null,
          token: null,
          expiresAt: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    }
  }, [client]);

  // Auto-refresh on mount
  useEffect(() => {
    if (autoRefresh) {
      refreshSession();
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [autoRefresh, refreshSession]);

  // Periodic refresh
  useEffect(() => {
    if (refreshInterval > 0 && state.isAuthenticated) {
      const interval = setInterval(refreshSession, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, state.isAuthenticated, refreshSession]);

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await client.signup(email, password, name);

        setState({
          user: result.user,
          token: result.token,
          expiresAt: new Date(result.expires_at),
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));
        throw err;
      }
    },
    [client]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await client.login(email, password);

        setState({
          user: result.user,
          token: result.token,
          expiresAt: new Date(result.expires_at),
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));
        throw err;
      }
    },
    [client]
  );

  const logout = useCallback(async () => {
    try {
      await client.logout();
    } finally {
      setState({
        user: null,
        token: null,
        expiresAt: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    }
  }, [client]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const getClient = useCallback(() => client, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signup,
      login,
      logout,
      refreshSession,
      clearError,
      getClient,
    }),
    [state, signup, login, logout, refreshSession, clearError, getClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth state and actions
 *
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Hook to get only the current user
 *
 * Returns null if not authenticated.
 */
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to get the current session token
 *
 * Returns null if not authenticated.
 */
export function useToken(): string | null {
  const { token } = useAuth();
  return token;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to get the auth client directly
 *
 * Useful for calling methods like forgotPassword, resetPassword, etc.
 */
export function useAuthClient(): AuthClient {
  const { getClient } = useAuth();
  return getClient();
}

/**
 * Hook for protected routes/components
 *
 * Redirects to login if not authenticated.
 *
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const { user, isLoading } = useRequireAuth('/login');
 *
 *   if (isLoading) return <Loading />;
 *
 *   return <div>Welcome, {user.email}!</div>;
 * }
 * ```
 */
export function useRequireAuth(loginUrl?: string): {
  user: User | null;
  isLoading: boolean;
} {
  const { user, isLoading, isAuthenticated, getClient } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && typeof window !== 'undefined') {
      const redirectUrl = loginUrl || getClient().getLoginUrl(window.location.href);
      window.location.href = redirectUrl;
    }
  }, [isLoading, isAuthenticated, loginUrl, getClient]);

  return { user, isLoading };
}
