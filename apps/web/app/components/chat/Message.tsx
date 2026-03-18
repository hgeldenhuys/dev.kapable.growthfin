/**
 * Message Component
 * Displays a single chat message with markdown rendering
 */

import { Bot, User } from 'lucide-react';
import { cn } from '~/lib/utils';
import { RelativeTime } from '../FormattedDate';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ThinkingBlock } from './ThinkingBlock';

export interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  timestamp: string;
}

export function Message({ role, content, thinkingContent, timestamp }: MessageProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-3 mb-6', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 space-y-2 max-w-[85%]', isUser && 'flex flex-col items-end')}>
        {/* Thinking Block - Only for assistant messages */}
        {!isUser && thinkingContent && (
          <ThinkingBlock content={thinkingContent} />
        )}

        <div
          className={cn(
            'rounded-lg px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !className;
                    return !isInline && match ? (
                      <SyntaxHighlighter
                        style={oneDark as any}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
          <RelativeTime date={timestamp} />
        </div>
      </div>
    </div>
  );
}
