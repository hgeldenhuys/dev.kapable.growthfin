/**
 * SignalDB Provider
 *
 * Wrap your app with this provider to enable SignalDB hooks.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface SignalDBConfig {
  /** Your SignalDB API key */
  apiKey: string;
  /** API endpoint (default: api.signaldb.live) */
  endpoint?: string;
}

export interface SignalDBContextValue {
  apiKey: string;
  baseUrl: string;
  /** Make an authenticated fetch request */
  fetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const SignalDBContext = createContext<SignalDBContextValue | null>(null);

interface SignalDBProviderProps extends SignalDBConfig {
  children: ReactNode;
}

export function SignalDBProvider({
  apiKey,
  endpoint = 'https://api.signaldb.live',
  children,
}: SignalDBProviderProps) {
  const value = useMemo<SignalDBContextValue>(() => {
    const baseUrl = endpoint.replace(/\/$/, '');

    return {
      apiKey,
      baseUrl,
      fetch: async (path: string, options: RequestInit = {}) => {
        const url = `${baseUrl}/api/v1${path}`;
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${apiKey}`);
        headers.set('Content-Type', 'application/json');

        return fetch(url, {
          ...options,
          headers,
        });
      },
    };
  }, [apiKey, endpoint]);

  return (
    <SignalDBContext.Provider value={value}>
      {children}
    </SignalDBContext.Provider>
  );
}

export function useSignalDB(): SignalDBContextValue {
  const context = useContext(SignalDBContext);

  if (!context) {
    throw new Error('useSignalDB must be used within a SignalDBProvider');
  }

  return context;
}
