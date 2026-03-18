/**
 * ThinkingBlock Component
 * Collapsible display for Claude's reasoning process
 */

import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Brain, ChevronDown } from 'lucide-react';

interface ThinkingBlockProps {
  content: string;
  defaultOpen?: boolean;
}

export function ThinkingBlock({ content, defaultOpen = false }: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-muted rounded-lg bg-muted/30 mb-3">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span>Thinking process</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 py-3 border-t border-muted">
          <div className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
            {content}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
