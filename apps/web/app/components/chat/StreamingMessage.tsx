/**
 * StreamingMessage Component
 * Displays a streaming message with typing indicator
 */

import { Bot } from 'lucide-react';
import { cn } from '~/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

export interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3 mb-6">
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          'bg-muted text-muted-foreground animate-pulse'
        )}
      >
        <Bot className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 max-w-[85%]">
        <div className="rounded-lg px-4 py-3 bg-muted">
          {content ? (
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
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
                  •
                </span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>
                  •
                </span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>
                  •
                </span>
              </span>
              <span>AI is thinking</span>
            </div>
          )}
        </div>
        {content && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
            <span className="inline-flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Streaming...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
