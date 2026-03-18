/**
 * Documentation Viewer Component
 * MDX renderer with syntax highlighting and custom components
 */

import { useState } from 'react';
import { Check, Copy, ExternalLink, AlertCircle, Info, Lightbulb, AlertTriangle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';

// Custom components for MDX
export const mdxComponents = {
  // Headings
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="scroll-mt-20 text-4xl font-bold tracking-tight mb-4 mt-8 first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      id={id}
      className="scroll-mt-20 text-3xl font-semibold tracking-tight mb-3 mt-8 border-b pb-2"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      id={id}
      className="scroll-mt-20 text-2xl font-semibold tracking-tight mb-2 mt-6"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      id={id}
      className="scroll-mt-20 text-xl font-semibold tracking-tight mb-2 mt-4"
      {...props}
    >
      {children}
    </h4>
  ),

  // Paragraphs and text
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="leading-7 mb-4" {...props}>
      {children}
    </p>
  ),

  // Links
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...props}
    >
      {children}
      {href?.startsWith('http') && (
        <ExternalLink className="inline-block ml-1 h-3 w-3" />
      )}
    </a>
  ),

  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-4 ml-6 list-disc space-y-2" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-4 ml-6 list-decimal space-y-2" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),

  // Code blocks
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <CodeBlock {...props}>{children}</CodeBlock>
  ),
  code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn('font-mono text-sm', className)} {...props}>
        {children}
      </code>
    );
  },

  // Tables
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="border-b bg-muted/50" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody {...props}>{children}</tbody>
  ),
  tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="border-b transition-colors hover:bg-muted/50" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="px-4 py-2 text-left font-semibold [&[align=center]]:text-center [&[align=right]]:text-right"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      className="px-4 py-2 [&[align=center]]:text-center [&[align=right]]:text-right"
      {...props}
    >
      {children}
    </td>
  ),

  // Blockquote
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote
      className="mt-6 border-l-4 border-primary/30 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-8 border-border" {...props} />
  ),

  // Custom callouts
  Callout,
  Warning: ({ children }: { children: React.ReactNode }) => (
    <Callout type="warning">{children}</Callout>
  ),
  Tip: ({ children }: { children: React.ReactNode }) => (
    <Callout type="tip">{children}</Callout>
  ),
  Info: ({ children }: { children: React.ReactNode }) => (
    <Callout type="info">{children}</Callout>
  ),
};

// Code block with copy button
function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);

  const extractCode = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractCode).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      return extractCode((node as { props: { children?: React.ReactNode } }).props.children);
    }
    return '';
  };

  const handleCopy = async () => {
    const code = extractCode(children);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <pre
        className="overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-sm"
        {...props}
      >
        {children}
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}

// Callout component
interface CalloutProps {
  type?: 'info' | 'warning' | 'tip' | 'error';
  title?: string;
  children: React.ReactNode;
}

function Callout({ type = 'info', title, children }: CalloutProps) {
  const config = {
    info: {
      icon: Info,
      title: title || 'Info',
      variant: 'default' as const,
    },
    warning: {
      icon: AlertTriangle,
      title: title || 'Warning',
      variant: 'destructive' as const,
    },
    tip: {
      icon: Lightbulb,
      title: title || 'Tip',
      variant: 'default' as const,
    },
    error: {
      icon: AlertCircle,
      title: title || 'Error',
      variant: 'destructive' as const,
    },
  };

  const { icon: Icon, title: defaultTitle, variant } = config[type];

  return (
    <Alert variant={variant} className="my-4">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title || defaultTitle}</AlertTitle>
      <AlertDescription className="[&>p]:mb-0">{children}</AlertDescription>
    </Alert>
  );
}

// Main DocViewer component
interface DocViewerProps {
  children: React.ReactNode;
  className?: string;
}

export function DocViewer({ children, className }: DocViewerProps) {
  return (
    <article className={cn('docs-content prose prose-slate dark:prose-invert max-w-none', className)}>
      {children}
    </article>
  );
}
