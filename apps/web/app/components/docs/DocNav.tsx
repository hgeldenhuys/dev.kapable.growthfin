/**
 * Documentation Navigation Component
 * Table of contents with scroll spy
 */

import { useEffect, useState } from 'react';
import { cn } from '~/lib/utils';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Button } from '~/components/ui/button';

export interface Heading {
  id: string;
  text: string;
  level: number; // 1-6 (h1-h6)
}

export interface DocNavProps {
  headings: Heading[];
  className?: string;
}

export function DocNav({ headings, className }: DocNavProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Scroll spy implementation
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 1,
      }
    );

    // Observe all headings
    const elements = headings.map((h) => document.getElementById(h.id)).filter(Boolean);
    for (const el of elements) {
      if (el) observer.observe(el);
    }

    return () => {
      for (const el of elements) {
        if (el) observer.unobserve(el);
      }
    };
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const top = element.offsetTop - 80; // Offset for sticky header
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={cn('docs-nav', className)}>
      <div className="mb-2 text-sm font-semibold">On this page</div>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="space-y-1">
          {headings.map((heading) => (
            <Button
              key={heading.id}
              variant="ghost"
              size="sm"
              onClick={() => handleClick(heading.id)}
              className={cn(
                'w-full justify-start text-left font-normal',
                heading.level === 2 && 'pl-2',
                heading.level === 3 && 'pl-4',
                heading.level === 4 && 'pl-6',
                heading.level > 4 && 'pl-8',
                activeId === heading.id
                  ? 'text-primary font-medium bg-accent'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="truncate">{heading.text}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
