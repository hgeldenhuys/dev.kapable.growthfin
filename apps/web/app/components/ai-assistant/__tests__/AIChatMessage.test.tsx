/// <reference lib="dom" />

/**
 * US-AI-015: Frontend Component Tests
 * AIChatMessage Component Tests
 */

import { describe, test, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { AIChatMessage } from '../AIChatMessage';
import type { AIMessage } from '../../../lib/api/ai-assistant';

describe('AIChatMessage', () => {
  const mockDate = new Date('2025-01-15T10:30:00Z').toISOString();

  test('should render user message with correct styling', () => {
    const message: AIMessage = {
      id: '1',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'user',
      content: 'Hello AI',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    render(<AIChatMessage message={message} />);

    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    
    // User message should be right-aligned
    const messageContainer = screen.getByTestId('ai-chat-message-user');
    expect(messageContainer).toHaveClass('justify-end');
    
    // Should have primary background
    const messageContent = messageContainer.querySelector('.bg-primary');
    expect(messageContent).toBeInTheDocument();
  });

  test('should render assistant message with correct styling', () => {
    const message: AIMessage = {
      id: '2',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'assistant',
      content: 'I can help you with that',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    render(<AIChatMessage message={message} />);

    expect(screen.getByText('I can help you with that')).toBeInTheDocument();
    
    // Assistant message should be left-aligned
    const messageContainer = screen.getByTestId('ai-chat-message-assistant');
    expect(messageContainer).toHaveClass('justify-start');
    
    // Should have muted background
    const messageContent = messageContainer.querySelector('.bg-muted');
    expect(messageContent).toBeInTheDocument();
  });

  test('should render assistant message with markdown (bold)', () => {
    const message: AIMessage = {
      id: '3',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'assistant',
      content: '**Bold** text here',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    render(<AIChatMessage message={message} />);

    // Markdown should be rendered (strong tag for bold)
    const strongElement = screen.getByText('Bold');
    expect(strongElement.tagName).toBe('STRONG');
  });

  test('should render assistant message with markdown (lists)', () => {
    const message: AIMessage = {
      id: '4',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'assistant',
      content: '- Item 1\n- Item 2\n- Item 3',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    render(<AIChatMessage message={message} />);

    // Check if list items are rendered
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  test('should display timestamp in HH:mm format', () => {
    const message: AIMessage = {
      id: '5',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'user',
      content: 'Test message',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    render(<AIChatMessage message={message} />);

    // Check for timestamp (format depends on timezone)
    const timestamp = screen.getByText(/\d{2}:\d{2}/);
    expect(timestamp).toBeInTheDocument();
    expect(timestamp).toHaveClass('text-xs', 'opacity-70');
  });

  test('should render long user messages with proper text wrapping', () => {
    const longMessage = 'This is a very long message that should wrap properly in the chat interface without breaking the layout or causing horizontal scroll issues.'.repeat(3);
    
    const message: AIMessage = {
      id: '6',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'user',
      content: longMessage,
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    const { container } = render(<AIChatMessage message={message} />);

    // Check for whitespace-pre-wrap and break-words classes
    const messageContent = container.querySelector('.whitespace-pre-wrap');
    expect(messageContent).toBeInTheDocument();
    expect(messageContent).toHaveClass('break-words');
  });

  test('should handle empty message content gracefully', () => {
    const message: AIMessage = {
      id: '7',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'user',
      content: '',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    const { container } = render(<AIChatMessage message={message} />);
    
    // Should render without errors
    expect(container).toBeTruthy();
  });

  test('should apply max-width constraint', () => {
    const message: AIMessage = {
      id: '8',
      conversationId: 'conv-1',
      userId: 'user-1',
      role: 'user',
      content: 'Test',
      context: {},
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    const { container } = render(<AIChatMessage message={message} />);

    // Check for max-w-[80%] class
    const messageContent = container.querySelector('.max-w-\\[80\\%\\]');
    expect(messageContent).toBeInTheDocument();
  });
});
