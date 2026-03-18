/**
 * US-AI-010: Message List and Display
 * Individual message component with markdown support + voice playback
 */

import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { AIMessage } from '../../lib/api/ai-assistant';

export interface AIChatMessageProps {
  message: AIMessage;
  onSpeak?: (text: string) => void;
  onStopSpeaking?: () => void;
  isSpeaking?: boolean;
  isSpeakLoading?: boolean;
}

export function AIChatMessage({
  message,
  onSpeak,
  onStopSpeaking,
  isSpeaking,
  isSpeakLoading,
}: AIChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`ai-chat-message-${message.role}`}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg p-3 shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs opacity-70">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
          {isAssistant && onSpeak && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-60 hover:opacity-100"
              onClick={() => {
                if (isSpeaking) {
                  onStopSpeaking?.();
                } else {
                  onSpeak(message.content);
                }
              }}
              disabled={isSpeakLoading}
              title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
              data-testid="ai-message-speak"
            >
              {isSpeakLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isSpeaking ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
