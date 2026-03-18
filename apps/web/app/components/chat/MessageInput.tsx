/**
 * MessageInput Component
 * Text input for sending chat messages with keyboard shortcuts
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

export interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function MessageInput({ onSend, disabled, isLoading }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    onSend(trimmedMessage);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea (max 5 lines)
    const textarea = e.target;
    textarea.style.height = 'auto';
    const lineHeight = 24; // approximate line height in pixels
    const maxHeight = lineHeight * 5;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line, Esc to clear)"
          disabled={disabled}
          className="min-h-[48px] max-h-[120px] resize-none pr-12"
          rows={1}
        />
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {isLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          )}
        </div>
      </div>
      <Button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        size="icon"
        className="h-12 w-12 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
