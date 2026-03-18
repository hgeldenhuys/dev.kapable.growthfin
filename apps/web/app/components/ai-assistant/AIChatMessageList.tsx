/**
 * US-AI-010: Message List and Display
 * Scrollable message list with auto-scroll to bottom
 */

import { useEffect, useRef } from 'react';
import { AIChatMessage } from './AIChatMessage';
import type { AIMessage } from '../../lib/api/ai-assistant';
import { cn } from '../../lib/utils';

export interface AIChatMessageListProps {
  messages: AIMessage[];
  onSpeak?: (text: string) => void;
  onStopSpeaking?: () => void;
  isSpeaking?: boolean;
  isSpeakLoading?: boolean;
  className?: string;
}

export function AIChatMessageList({
  messages,
  onSpeak,
  onStopSpeaking,
  isSpeaking,
  isSpeakLoading,
  className,
}: AIChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      className={cn('flex-1 overflow-y-auto p-4 space-y-4', className)}
      data-testid="ai-chat-message-list"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">AI Assistant</p>
            <p className="text-sm">Ask me anything about your current page or workflow</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <AIChatMessage
              key={message.id}
              message={message}
              onSpeak={onSpeak}
              onStopSpeaking={onStopSpeaking}
              isSpeaking={isSpeaking}
              isSpeakLoading={isSpeakLoading}
            />
          ))}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}
