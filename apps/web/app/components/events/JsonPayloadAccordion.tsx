/**
 * JsonPayloadAccordion Component
 *
 * Displays raw JSON payload in a collapsible accordion with syntax highlighting
 */

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { Button } from '../ui/button';
import { cn } from '~/lib/utils';

interface JsonPayloadAccordionProps {
  payload: any;
  className?: string;
}

export function JsonPayloadAccordion({ payload, className }: JsonPayloadAccordionProps) {
  const [copied, setCopied] = useState(false);

  const formattedJson = JSON.stringify(payload, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Accordion type="single" collapsible className={cn('w-full', className)}>
      <AccordionItem value="json-payload">
        <AccordionTrigger>
          <span className="text-sm font-medium">Raw JSON Payload</span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 z-10"
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
            <pre className="bg-muted rounded-md p-4 pr-24 max-h-96 overflow-auto text-xs">
              <code className="font-mono">{formattedJson}</code>
            </pre>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
