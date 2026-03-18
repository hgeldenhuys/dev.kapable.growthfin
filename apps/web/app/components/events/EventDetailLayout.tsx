/**
 * EventDetailLayout Component
 *
 * Layout wrapper for event detail pages
 * Shows header with event metadata, main content area, and JSON payload footer
 */

import { Calendar, Hash, Activity } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { JsonPayloadAccordion } from './JsonPayloadAccordion';
import type { HookEvent } from '~/hooks/useHookEvent';
import { cn } from '~/lib/utils';

interface EventDetailLayoutProps {
  event: HookEvent;
  children: ReactNode;
  className?: string;
}

// Event type color mapping
const EVENT_COLORS: Record<string, string> = {
  PreToolUse: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PostToolUse: 'bg-green-500/10 text-green-500 border-green-500/20',
  Stop: 'bg-red-500/10 text-red-500 border-red-500/20',
  SubagentStop: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  UserPromptSubmit: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Notification: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  PreCompact: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  SessionStart: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  SessionEnd: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

export function EventDetailLayout({ event, children, className }: EventDetailLayoutProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDateRelative = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const eventColor = EVENT_COLORS[event.eventName] || EVENT_COLORS['Notification'];

  return (
    <div className={cn('flex flex-col gap-6 pb-8', className)}>
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={cn('border', eventColor)}>
                {event.eventName}
              </Badge>
              {event.toolName && (
                <Badge variant="outline" className="font-mono text-xs">
                  {event.toolName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(event.createdAt)}</span>
              <span className="text-xs">({formatDateRelative(event.createdAt)})</span>
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Event Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Event ID
                </p>
                <p className="font-mono text-xs break-all">{event.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Session ID
                </p>
                <p className="font-mono text-xs break-all">{event.sessionId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Project ID</p>
                <p className="font-mono text-xs break-all">{event.projectId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Status</p>
                <Badge variant={event.processed ? 'default' : 'outline'} className="text-xs">
                  {event.processed ? 'Processed' : 'Pending'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {children}
      </div>

      {/* Footer - JSON Payload */}
      <div className="space-y-2">
        <JsonPayloadAccordion payload={event.payload} />
      </div>
    </div>
  );
}
