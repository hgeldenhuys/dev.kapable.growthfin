/**
 * EnrichmentActivityLog Component
 * Shows real-time enrichment activity (tool calls, progress) during active enrichment.
 * Replaces the simple spinner with actual activity information.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Mail,
  Linkedin,
  Building2,
  Wrench,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import { useToolCalls } from '~/hooks/useToolCalls';

interface EnrichmentActivityLogProps {
  leadId: string;
  workspaceId: string;
  isEnriching: boolean;
  createdAt?: string;
  requestedSources: string[];
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'web_search':
      return Search;
    case 'verify_email':
      return Mail;
    case 'enrich_linkedin':
      return Linkedin;
    case 'lookup_business':
      return Building2;
    case 'lookup_sa_company':
      return MapPin;
    default:
      return Wrench;
  }
}

function formatToolName(toolName: string): string {
  const names: Record<string, string> = {
    web_search: 'Web Search',
    verify_email: 'Email Verification',
    enrich_linkedin: 'LinkedIn Lookup',
    lookup_business: 'Business Lookup',
    lookup_sa_company: 'SA Company Lookup',
    update_contact: 'Update Contact',
  };
  return names[toolName] || toolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getToolDescription(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'web_search':
      return `Searching: "${args.query || args.q || 'unknown'}"`;
    case 'verify_email':
      return `Verifying: ${args.email || 'email'}`;
    case 'enrich_linkedin':
      return `Looking up: ${args.url || args.username || 'profile'}`;
    case 'lookup_business':
      return `Finding: ${args.query || args.name || 'business'}`;
    case 'lookup_sa_company':
      return `Checking: ${args.company_name || args.registration_number || 'company'}`;
    case 'update_contact':
      return `Saving enriched data`;
    default:
      return '';
  }
}

export function EnrichmentActivityLog({
  leadId,
  workspaceId,
  isEnriching,
  createdAt,
  requestedSources,
}: EnrichmentActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer that ticks every second
  useEffect(() => {
    if (!isEnriching) {
      setElapsedSeconds(0);
      return;
    }
    const computeElapsed = () => {
      if (createdAt) {
        const ms = Date.now() - new Date(createdAt).getTime();
        return Math.max(0, Math.floor(ms / 1000));
      }
      return 0;
    };
    setElapsedSeconds(computeElapsed());
    const timer = setInterval(() => setElapsedSeconds(computeElapsed()), 1000);
    return () => clearInterval(timer);
  }, [isEnriching, createdAt]);

  // Poll tool calls every 3 seconds while enrichment is active
  const { data: toolCallsData } = useToolCalls(leadId, workspaceId, {
    pollingInterval: isEnriching ? 3000 : undefined,
  });

  const toolCalls = toolCallsData?.toolCalls || [];

  // Auto-scroll to bottom when new tool calls arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [toolCalls.length]);

  if (!isEnriching && toolCalls.length === 0) {
    return null;
  }

  const isOvertime = elapsedSeconds > 60;

  return (
    <Card className={cn(
      'border-2 transition-colors',
      isEnriching
        ? isOvertime
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-primary/30 bg-primary/5'
        : 'border-green-500/30 bg-green-500/5'
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEnriching ? (
              <Loader2 className={cn('h-4 w-4 animate-spin', isOvertime ? 'text-destructive' : 'text-primary')} />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
            <span>{isEnriching ? 'Enrichment in Progress' : 'Enrichment Complete'}</span>
          </div>
          <div className="flex items-center gap-3">
            {requestedSources.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                {requestedSources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
              </span>
            )}
            {isEnriching && (
              <span className={cn(
                'tabular-nums font-mono text-sm',
                isOvertime ? 'text-destructive font-semibold' : 'text-muted-foreground'
              )}>
                {elapsedSeconds}s
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Activity Timeline */}
        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto space-y-0 pr-1"
        >
          {toolCalls.length === 0 && isEnriching && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Waiting for AI to start tool calls...</span>
            </div>
          )}

          {toolCalls.map((tc, index) => {
            const Icon = getToolIcon(tc.toolName);
            const isSuccess = tc.status === 'success';
            const description = getToolDescription(tc.toolName, tc.arguments);

            return (
              <div key={tc.id} className="relative flex items-start gap-3 py-2">
                {/* Timeline connector */}
                {index < toolCalls.length - 1 && (
                  <div className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />
                )}

                {/* Icon */}
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border z-10 bg-background',
                  isSuccess ? 'border-green-500/50' : 'border-destructive/50'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{formatToolName(tc.toolName)}</span>
                    {isSuccess ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {tc.durationMs != null && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(tc.durationMs)}
                      </span>
                    )}
                  </div>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {description}
                    </p>
                  )}
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(tc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            );
          })}

          {/* "Still working" indicator at the bottom when enriching */}
          {isEnriching && toolCalls.length > 0 && (
            <div className="flex items-center gap-3 py-2 text-muted-foreground">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              </div>
              <span className="text-xs">AI is analyzing results...</span>
            </div>
          )}
        </div>

        {/* Summary when complete */}
        {!isEnriching && toolCalls.length > 0 && (
          <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
            <span>{toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}</span>
            <span>
              {toolCalls.filter(t => t.status === 'success').length} succeeded
            </span>
            {toolCalls.some(t => t.status === 'failed') && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {toolCalls.filter(t => t.status === 'failed').length} failed
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
