/**
 * ContextualHelp Component
 * Small "?" icon that opens a Popover with contextual help text.
 */

import { Link } from 'react-router';
import { HelpCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

const HELP_CONTENT: Record<string, { text: string; guideStep?: number }> = {
  'lead-score': {
    text: 'Scores 0-100 based on fit (company size, industry, geography), engagement, and AI propensity signals.',
    guideStep: 9,
  },
  enrichment: {
    text: 'Uses AI to find missing company info, social profiles, and contact details from public sources.',
    guideStep: 11,
  },
  'sandbox-mode': {
    text: 'When ON, emails and SMS are simulated - nothing is actually sent. Safe for testing.',
    guideStep: 12,
  },
  campaigns: {
    text: 'Bulk outreach via email or SMS. Create a template first, then build a campaign to send it.',
    guideStep: 8,
  },
  templates: {
    text: 'Reusable message formats with merge fields like {{firstName}} that auto-fill per recipient.',
    guideStep: 7,
  },
  lists: {
    text: 'Named groups of leads or contacts. Use lists as campaign audiences or for organizing your pipeline.',
    guideStep: 6,
  },
  activities: {
    text: 'Tasks, calls, meetings, and emails. Track all interactions with your leads and contacts.',
    guideStep: 5,
  },
  'my-queue': {
    text: 'Leads assigned specifically to you, prioritized by score and urgency.',
  },
  calendar: {
    text: 'Weekly view of your scheduled meetings and appointments.',
  },
  analytics: {
    text: 'Campaign performance metrics, research stats, and pipeline reports.',
  },
};

interface ContextualHelpProps {
  topic: string;
  className?: string;
  workspaceId?: string;
}

export function ContextualHelp({ topic, className, workspaceId }: ContextualHelpProps) {
  const content = HELP_CONTENT[topic];
  if (!content) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors',
            className,
          )}
          aria-label={`Help: ${topic}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top" align="center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {content.text}
        </p>
        {content.guideStep != null && workspaceId && (
          <Link
            to={`/dashboard/${workspaceId}/docs/getting-started#step-${content.guideStep}`}
            className="mt-2 inline-block text-xs text-primary hover:underline"
          >
            Learn more
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
