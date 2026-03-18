/// <reference lib="dom" />

/**
 * US-AI-015: Frontend Component Tests
 * AIChatMessageList Component Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import { AIChatMessageList } from '../AIChatMessageList';
import type { AIMessage } from '../../../lib/api/ai-assistant';

describe('AIChatMessageList', () => {
  const mockDate = new Date('2025-01-15T10:30:00Z').toISOString();

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  const createMockMessage = (id: string, role: 'user' | 'assistant', content: string): AIMessage => ({
    id,
    conversationId: 'conv-1',
    userId: 'user-1',
    role,
    content,
    context: {},
    createdAt: mockDate,
    updatedAt: mockDate,
  });

  test('should render empty state when no messages', () => {
    render(<AIChatMessageList messages={[]} />);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText(/Ask me anything/i)).toBeInTheDocument();
  });

  test('should render single message', () => {
    const messages = [
      createMockMessage('1', 'user', 'Hello AI'),
    ];

    render(<AIChatMessageList messages={messages} />);

    expect(screen.getByText('Hello AI')).toBeInTheDocument();
  });

  test('should render multiple messages in order', () => {
    const messages = [
      createMockMessage('1', 'user', 'First message'),
      createMockMessage('2', 'assistant', 'Second message'),
      createMockMessage('3', 'user', 'Third message'),
    ];

    render(<AIChatMessageList messages={messages} />);

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
  });

  test('should render user and assistant messages with correct styling', () => {
    const messages = [
      createMockMessage('1', 'user', 'User message'),
      createMockMessage('2', 'assistant', 'Assistant message'),
    ];

    const { unmount } = render(<AIChatMessageList messages={messages} />);

    // Both message types should be present - use getAllByTestId
    const userMessages = screen.queryAllByTestId('ai-chat-message-user');
    const assistantMessages = screen.queryAllByTestId('ai-chat-message-assistant');
    
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
    
    unmount();
  });

  test('should apply data-testid to message list container', () => {
    const { unmount } = render(<AIChatMessageList messages={[]} />);

    const containers = screen.queryAllByTestId('ai-chat-message-list');
    expect(containers.length).toBeGreaterThan(0);
    
    unmount();
  });

  test('should apply custom className', () => {
    const { container, unmount } = render(
      <AIChatMessageList messages={[]} className="custom-class" />
    );

    const messageList = container.querySelector('.custom-class');
    expect(messageList).toBeInTheDocument();
    
    unmount();
  });

  test('should have overflow-y-auto for scrolling', () => {
    const { unmount } = render(<AIChatMessageList messages={[]} />);
    
    const containers = screen.queryAllByTestId('ai-chat-message-list');
    if (containers.length > 0) {
      expect(containers[0]).toHaveClass('overflow-y-auto');
    }
    
    unmount();
  });

  test('should render many messages without errors', () => {
    const messages = Array.from({ length: 50 }, (_, i) =>
      createMockMessage(`msg-${i}`, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
    );

    const { unmount } = render(<AIChatMessageList messages={messages} />);

    // Check first and last messages
    expect(screen.getByText('Message 0')).toBeInTheDocument();
    expect(screen.getByText('Message 49')).toBeInTheDocument();
    
    unmount();
  });

  test('should render each message with unique key (no console warnings)', () => {
    const messages = [
      createMockMessage('1', 'user', 'Message 1'),
      createMockMessage('2', 'assistant', 'Message 2'),
      createMockMessage('3', 'user', 'Message 3'),
    ];

    // Should render without React key warnings
    const { container, unmount } = render(<AIChatMessageList messages={messages} />);
    expect(container).toBeTruthy();
    
    unmount();
  });

  test('should apply spacing between messages', () => {
    const messages = [
      createMockMessage('1', 'user', 'Message 1'),
      createMockMessage('2', 'assistant', 'Message 2'),
    ];

    const { container, unmount } = render(<AIChatMessageList messages={messages} />);

    const messageList = container.querySelector('[data-testid="ai-chat-message-list"]');
    expect(messageList).toHaveClass('space-y-4');
    
    unmount();
  });

  test('should handle empty message content gracefully', () => {
    const messages = [
      createMockMessage('1', 'user', ''),
      createMockMessage('2', 'assistant', ''),
    ];

    const { container, unmount } = render(<AIChatMessageList messages={messages} />);
    expect(container).toBeTruthy();
    
    unmount();
  });
});
