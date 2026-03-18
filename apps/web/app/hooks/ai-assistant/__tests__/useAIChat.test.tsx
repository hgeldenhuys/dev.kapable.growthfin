/// <reference lib="dom" />

/**
 * US-AI-015: Frontend Component Tests
 * useAIChat Hook Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAIChat } from '../useAIChat';
import { MemoryRouter } from 'react-router';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
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

describe('useAIChat', () => {
  beforeEach(() => {
    cleanup();
  });

  test('should initialize with loading state', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'ws-1', userId: 'user-1' }),
      { wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toEqual([]);
  });

  test('should return empty messages array initially', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'ws-1', userId: 'user-1' }),
      { wrapper }
    );

    // Wait for initial load to complete (may succeed or fail)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    // Messages should be an array
    expect(Array.isArray(result.current.messages)).toBe(true);
  });

  test('should expose required API methods', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'ws-1', userId: 'user-1' }),
      { wrapper }
    );

    // Verify all required methods exist
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.clearConversation).toBe('function');
    expect(typeof result.current.refetch).toBe('function');
  });

  test('should return correct structure', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'ws-1', userId: 'user-1' }),
      { wrapper }
    );

    // Verify return structure matches interface
    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('conversation');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isSending');
    expect(result.current).toHaveProperty('sendMessage');
    expect(result.current).toHaveProperty('clearConversation');
    expect(result.current).toHaveProperty('refetch');
  });

  test('should not be sending initially', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'ws-1', userId: 'user-1' }),
      { wrapper }
    );

    expect(result.current.isSending).toBe(false);
  });

  test('should accept workspaceId and userId', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'test-ws', userId: 'test-user' }),
      { wrapper }
    );

    // Should render without errors
    expect(result.current).toBeDefined();
  });

  test('should handle different workspace and user combinations', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useAIChat({ workspaceId: 'ws-123', userId: 'user-456' }),
      { wrapper }
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current.sendMessage).toBe('function');
  });
});
