/// <reference lib="dom" />

/**
 * US-AI-015: Frontend Component Tests
 * AIChatInput Component Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AIChatInput } from '../AIChatInput';

const defaultVoiceProps = {
  onVoiceSend: async () => {},
  isRecording: false,
  isTranscribing: false,
  recordingDuration: 0,
  onStartRecording: async () => {},
  onCancelRecording: () => {},
  recordingError: null,
};

describe('AIChatInput', () => {
  beforeEach(() => {
    cleanup();
  });

  test('should render textarea with placeholder', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('Ask anything'));
  });

  test('should call onSend when Enter pressed (without Shift)', () => {
    let sentMessage = '';
    const handleSend = (msg: string) => { sentMessage = msg; };

    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input') as HTMLTextAreaElement;

    // Type message
    fireEvent.change(input, { target: { value: 'Test message' } });
    expect(input.value).toBe('Test message');

    // Press Enter (without Shift)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    // Message should be sent
    expect(sentMessage).toBe('Test message');
  });

  test('should NOT call onSend when Shift+Enter pressed', () => {
    let callCount = 0;
    const handleSend = () => { callCount++; };

    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    // Should NOT call onSend
    expect(callCount).toBe(0);
  });

  test('should clear input after sending message', () => {
    const handleSend = () => {};

    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input') as HTMLTextAreaElement;

    // Type message
    fireEvent.change(input, { target: { value: 'Test message' } });
    expect(input.value).toBe('Test message');

    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    // Input should be cleared
    expect(input.value).toBe('');
  });

  test('should be disabled when loading', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={true} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');
    expect(input).toBeDisabled();
  });

  test('should disable send button when input is empty', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const sendButton = screen.getByTestId('ai-chat-send-button');
    expect(sendButton).toBeDisabled();
  });

  test('should enable send button when input has text', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');
    const sendButton = screen.getByTestId('ai-chat-send-button');

    // Initially disabled
    expect(sendButton).toBeDisabled();

    // Type text
    fireEvent.change(input, { target: { value: 'Test' } });

    // Should be enabled
    expect(sendButton).not.toBeDisabled();
  });

  test('should disable send button when loading', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={true} {...defaultVoiceProps} />);

    const sendButton = screen.getByTestId('ai-chat-send-button');
    expect(sendButton).toBeDisabled();
  });

  test('should show character count when typing', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');

    // Type message
    fireEvent.change(input, { target: { value: 'Hello' } });

    // Should show character count
    expect(screen.getByText('5 characters')).toBeInTheDocument();
  });

  test('should not show character count when input is empty', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    // Should not show character count
    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
  });

  test('should call onSend via send button click', () => {
    let sentMessage = '';
    const handleSend = (msg: string) => { sentMessage = msg; };

    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');
    const sendButton = screen.getByTestId('ai-chat-send-button');

    // Type message
    fireEvent.change(input, { target: { value: 'Button test' } });

    // Click send button
    fireEvent.click(sendButton);

    // Message should be sent
    expect(sentMessage).toBe('Button test');
  });

  test('should not send empty/whitespace-only messages', () => {
    let callCount = 0;
    const handleSend = () => { callCount++; };

    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');

    // Try to send empty message
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(callCount).toBe(0);

    // Try to send whitespace-only message
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(callCount).toBe(0);
  });

  test('should trim whitespace from messages before sending', () => {
    let sentMessage = '';
    const handleSend = (msg: string) => { sentMessage = msg; };

    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const input = screen.getByTestId('ai-chat-input');

    // Type message with surrounding whitespace
    fireEvent.change(input, { target: { value: '  Test message  ' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    // Should be trimmed
    expect(sentMessage).toBe('Test message');
  });

  test('should apply custom className', () => {
    const handleSend = () => {};
    const { container } = render(
      <AIChatInput onSend={handleSend} isLoading={false} className="custom-class" {...defaultVoiceProps} />
    );

    const form = container.querySelector('form');
    expect(form).toHaveClass('custom-class');
  });

  test('should render mic button', () => {
    const handleSend = () => {};
    render(<AIChatInput onSend={handleSend} isLoading={false} {...defaultVoiceProps} />);

    const micButton = screen.getByTestId('ai-voice-record');
    expect(micButton).toBeInTheDocument();
  });

  test('should show recording UI when isRecording is true', () => {
    const handleSend = () => {};
    render(
      <AIChatInput
        onSend={handleSend}
        isLoading={false}
        {...defaultVoiceProps}
        isRecording={true}
        recordingDuration={5}
      />
    );

    expect(screen.getByText(/Recording 0:05/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-voice-stop')).toBeInTheDocument();
    expect(screen.getByTestId('ai-voice-cancel')).toBeInTheDocument();
  });
});
