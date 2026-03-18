/**
 * US-AI-011: Chat Input and Send
 * Multi-line textarea with send button + voice recording
 */

import { useState, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Mic, Square, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

export interface AIChatInputProps {
  onSend: (message: string) => void;
  onVoiceSend: () => Promise<void>;
  isLoading: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  onStartRecording: () => Promise<void>;
  onCancelRecording: () => void;
  recordingError: string | null;
  className?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AIChatInput({
  onSend,
  onVoiceSend,
  isLoading,
  isRecording,
  isTranscribing,
  recordingDuration,
  onStartRecording,
  onCancelRecording,
  recordingError,
  className,
}: AIChatInputProps) {
  const [message, setMessage] = useState('');

  // Show toast on recording error
  useEffect(() => {
    if (recordingError) {
      toast.error('Microphone error', { description: recordingError });
    }
  }, [recordingError]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    onSend(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      await onVoiceSend();
    } else {
      await onStartRecording();
    }
  };

  // Recording mode UI
  if (isRecording) {
    return (
      <div className={cn('border-t p-4 pb-2', className)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-medium text-red-600">
              Recording {formatDuration(recordingDuration)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-destructive"
            onClick={onCancelRecording}
            data-testid="ai-voice-cancel"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-10 w-10 bg-red-500 hover:bg-red-600"
            onClick={handleMicClick}
            data-testid="ai-voice-stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Transcribing state
  if (isTranscribing) {
    return (
      <div className={cn('border-t p-4 pb-2', className)}>
        <div className="flex items-center gap-2 justify-center py-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
          <span className="text-sm text-muted-foreground ml-2">Transcribing...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('border-t p-4 pb-0', className)}>
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
          className="resize-none min-h-[60px]"
          rows={2}
          disabled={isLoading}
          data-testid="ai-chat-input"
        />
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[29px] w-10 shrink-0"
            onClick={handleMicClick}
            disabled={isLoading}
            title="Record voice message"
            data-testid="ai-voice-record"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            type="submit"
            disabled={!message.trim() || isLoading}
            size="icon"
            className="h-[29px] w-10 shrink-0"
            data-testid="ai-chat-send-button"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={cn("text-xs text-muted-foreground mt-1", (message.length === 0) && "invisible")}>
        {message.length} characters
      </div>
    </form>
  );
}
