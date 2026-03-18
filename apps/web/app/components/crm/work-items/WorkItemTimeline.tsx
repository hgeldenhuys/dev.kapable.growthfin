/**
 * Work Item Timeline Component (UI-001)
 * Displays chronological history of work item lifecycle
 */

import {
  PlusCircle,
  UserCheck,
  UserMinus,
  CheckCircle,
  AlertCircle,
  XCircle,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  useWorkItemHistory,
  formatRelativeTime,
  type WorkItemHistoryEvent,
} from '~/hooks/useWorkItemHistory';
import type { WorkItem } from '@agios/db';

interface WorkItemTimelineProps {
  workItem: WorkItem;
  className?: string;
}

const eventConfig: Record<WorkItemHistoryEvent['type'], {
  icon: typeof PlusCircle;
  color: string;
  bgColor: string;
}> = {
  created: {
    icon: PlusCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  claimed: {
    icon: UserCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  unclaimed: {
    icon: UserMinus,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  expired: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  updated: {
    icon: Settings,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
  },
};

function TimelineEvent({ event }: { event: WorkItemHistoryEvent }) {
  const config = eventConfig[event.type];
  const Icon = config.icon;

  return (
    <div className="flex gap-3">
      {/* Timeline connector line + icon */}
      <div className="flex flex-col items-center">
        <div className={`p-2 rounded-full ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div className="flex-1 w-px bg-border" />
      </div>

      {/* Event content */}
      <div className="pb-6 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{event.description}</p>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(event.timestamp)}
          </span>
        </div>

        {/* Actor info */}
        {event.actor && (
          <p className="text-xs text-muted-foreground mt-1">
            by {event.actorType === 'ai' ? 'AI' : event.actorType === 'system' ? 'System' : 'User'}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {event.timestamp.toLocaleString()}
        </p>

        {/* Metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
            {Object.entries(event.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="font-mono">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkItemTimeline({ workItem, className }: WorkItemTimelineProps) {
  const events = useWorkItemHistory(workItem);

  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No history available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {events.map((event) => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
