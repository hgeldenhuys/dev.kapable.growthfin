/**
 * MarkdownViewer Component
 * Displays markdown content in a fullscreen dialog
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { FileText, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  title: string;
  content: string;
  description?: string;
  triggerText?: string;
  triggerIcon?: React.ReactNode;
}

export function MarkdownViewer({
  title,
  content,
  description,
  triggerText = "View Document",
  triggerIcon,
}: MarkdownViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {triggerIcon || <FileText className="h-4 w-4" />}
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`${
          isFullscreen
            ? "max-w-[100vw] w-[100vw] h-[100vh] m-0 rounded-none"
            : "max-w-4xl max-h-[90vh]"
        } transition-all duration-200`}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="shrink-0"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className={isFullscreen ? "h-[calc(100vh-100px)]" : "h-[70vh]"}>
          <div className="prose prose-sm dark:prose-invert max-w-none p-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Style headings
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold mb-4 mt-6">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-semibold mb-3 mt-5 border-b pb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold mb-2 mt-4">{children}</h3>
                ),
                // Style code blocks
                code: ({ inline, className, children, ...props }: any) => {
                  if (inline) {
                    return (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={`${className} block bg-muted p-4 rounded-lg overflow-x-auto`} {...props}>
                      {children}
                    </code>
                  );
                },
                // Style tables
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full divide-y divide-border">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-2 bg-muted text-left font-semibold">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 border-t">{children}</td>
                ),
                // Style blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic my-4">
                    {children}
                  </blockquote>
                ),
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                ),
                // Style links
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                // Style horizontal rules
                hr: () => <hr className="my-6 border-border" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
