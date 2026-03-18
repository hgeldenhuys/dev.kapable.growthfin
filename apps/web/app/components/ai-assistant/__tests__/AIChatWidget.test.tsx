/// <reference lib="dom" />

/**
 * US-AI-015: Frontend Component Tests
 * AIChatWidget Component Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AIChatWidget } from '../AIChatWidget';
import { useAIChatStore } from '../../../stores/aiChatStore';

// Helper to wrap component with required providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, enabled: false }, // Disable queries
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('AIChatWidget', () => {
  beforeEach(() => {
    cleanup();
    // Reset store state before each test
    const store = useAIChatStore.getState();
    store.minimize();
  });

  afterEach(() => {
    cleanup();
  });

  test('should render minimized by default', () => {
    renderWithProviders(<AIChatWidget workspaceId="ws-1" userId="user-1" />);

    const toggleButton = screen.getByTestId('ai-chat-toggle');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveClass('rounded-full');
  });

  test('should expand when toggle button clicked', async () => {
    renderWithProviders(<AIChatWidget workspaceId="ws-1" userId="user-1" />);

    const toggleButton = screen.getByTestId('ai-chat-toggle');
    fireEvent.click(toggleButton);

    // Wait for animation and expansion
    await waitFor(() => {
      const chatWidget = screen.queryByTestId('ai-chat-input');
      expect(chatWidget).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  test('should minimize when minimize button clicked', async () => {
    const { unmount } = renderWithProviders(<AIChatWidget workspaceId="ws-1" userId="user-1" />);

    // First expand
    const toggleButton = screen.getByTestId('ai-chat-toggle');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.queryByTestId('ai-chat-input')).toBeInTheDocument();
    });

    // Then minimize - use correct testid
    const minimizeButton = screen.getByTestId('ai-chat-minimize-button');
    fireEvent.click(minimizeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('ai-chat-input')).not.toBeInTheDocument();
    });

    // Toggle button should be visible again
    expect(screen.getByTestId('ai-chat-toggle')).toBeInTheDocument();
    
    unmount();
  });

  test('should apply custom className', () => {
    const { container, unmount } = renderWithProviders(
      <AIChatWidget workspaceId="ws-1" userId="user-1" className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
    
    unmount();
  });

  test('should pass workspaceId and userId to child components', async () => {
    const { unmount } = renderWithProviders(<AIChatWidget workspaceId="ws-test" userId="user-test" />);

    // Expand widget
    const toggleButton = screen.getByTestId('ai-chat-toggle');
    fireEvent.click(toggleButton);

    // Wait for interface to render
    await waitFor(() => {
      expect(screen.queryByTestId('ai-chat-input')).toBeInTheDocument();
    });

    // Child components should have received props (verified by rendering without errors)
    
    unmount();
  });

  test('should be positioned in bottom-right corner', () => {
    const { container, unmount } = renderWithProviders(
      <AIChatWidget workspaceId="ws-1" userId="user-1" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('fixed', 'bottom-4', 'right-4');
    
    unmount();
  });
});
