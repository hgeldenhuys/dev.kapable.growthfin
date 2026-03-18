/// <reference lib="dom" />

/**
 * Test utilities for hook testing
 * Provides wrappers with QueryClient, Router context, and fetch mocking
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';

/**
 * Creates a wrapper component with QueryClient and Router context
 */
export function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Creates a wrapper with data router context (needed for hooks using useRevalidator)
 */
export function createDataRouterWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => {
    const router = createMemoryRouter(
      [{ path: '/', element: <>{children}</> }],
      { initialEntries: ['/'] }
    );
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  };
}

/**
 * Mock fetch with typed responses
 */
export function mockFetch(responses: Record<string, { status?: number; body?: any; ok?: boolean }>) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const key = `${method} ${url}`;

    // Try exact match first, then URL-only match
    const match = responses[key] || responses[url];

    if (match) {
      const status = match.status ?? 200;
      const ok = match.ok ?? (status >= 200 && status < 300);
      return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: async () => match.body,
        text: async () => typeof match.body === 'string' ? match.body : JSON.stringify(match.body),
        headers: new Headers(),
      } as Response;
    }

    // Unmatched request - return 404
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Not Found' }),
      text: async () => 'Not Found',
      headers: new Headers(),
    } as Response;
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Mock fetch that captures requests for assertion
 */
export function mockFetchWithCapture(defaultResponse: { status?: number; body?: any } = { body: {} }) {
  const requests: Array<{ url: string; method: string; body?: any }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    let body: any;
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }
    requests.push({ url, method, body });

    const status = defaultResponse.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: 'OK',
      json: async () => defaultResponse.body,
      text: async () => JSON.stringify(defaultResponse.body),
      headers: new Headers(),
    } as Response;
  }) as typeof fetch;

  return {
    requests,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
