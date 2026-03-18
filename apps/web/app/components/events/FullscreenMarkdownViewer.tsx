/**
 * FullscreenMarkdownViewer Component
 *
 * True fullscreen markdown viewer that covers entire viewport
 * - Fixed position overlay (no Dialog/Modal backdrop behavior)
 * - ESC key to close
 * - Explicit close button only
 * - Markdown rendering with syntax highlighting
 * - Dark mode compatible
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Direct import to avoid barrel import issues
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import { Button } from '../ui/button';

interface FullscreenMarkdownViewerProps {
  content: string;
  onClose: () => void;
}

export function FullscreenMarkdownViewer({ content, onClose }: FullscreenMarkdownViewerProps) {
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when fullscreen is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-white dark:bg-slate-950">
      {/* Close button - absolute positioned in top-right */}
      <Button
        variant="outline"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-[10000] shadow-lg"
        aria-label="Close fullscreen viewer"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Content wrapper with max-width and padding */}
      <div className="max-w-4xl mx-auto py-16 px-8">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');

                return !inline && match ? (
                  <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: '1rem 0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code {...props} className={className}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
