/**
 * US-AI-010: Message List and Display
 * Typing indicator shown while AI is responding
 */

import { cn } from '../../lib/utils';

export function AIChatTypingIndicator() {
  return (
    <div className="flex justify-start px-4 pb-4" data-testid="ai-chat-typing-indicator">
      <div className="max-w-[80%] rounded-lg p-3 bg-muted">
        <div className="flex gap-1">
          <div
            className={cn(
              'w-2 h-2 rounded-full bg-foreground/40 animate-bounce',
              '[animation-delay:0ms]'
            )}
          />
          <div
            className={cn(
              'w-2 h-2 rounded-full bg-foreground/40 animate-bounce',
              '[animation-delay:150ms]'
            )}
          />
          <div
            className={cn(
              'w-2 h-2 rounded-full bg-foreground/40 animate-bounce',
              '[animation-delay:300ms]'
            )}
          />
        </div>
      </div>
    </div>
  );
}
