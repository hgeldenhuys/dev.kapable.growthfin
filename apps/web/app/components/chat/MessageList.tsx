/**
 * MessageList Component
 * Displays a list of chat messages with streaming support
 */

import { Message, MessageProps } from './Message';
import { StreamingMessage } from './StreamingMessage';
import { Loader2 } from 'lucide-react';

export interface MessageListProps {
  messages: Array<MessageProps & { id: string; thinkingContent?: string }>;
  streamingMessage?: string;
  isLoading?: boolean;
}

export function MessageList({ messages, streamingMessage, isLoading }: MessageListProps) {
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-6">
      {messages.map((message) => (
        <Message
          key={message.id}
          role={message.role}
          content={message.content}
          thinkingContent={message.thinkingContent}
          timestamp={message.timestamp}
        />
      ))}
      {streamingMessage !== undefined && (
        <StreamingMessage content={streamingMessage} />
      )}
    </div>
  );
}
