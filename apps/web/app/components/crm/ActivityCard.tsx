/**
 * ActivityCard Component
 * Display activity summary with icon, status, priority
 */

import { Link } from 'react-router';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { ActivityTypeBadge } from './ActivityTypeBadge';
import { ActivityPriorityBadge } from './ActivityPriorityBadge';
import { ActivityStatusBadge } from './ActivityStatusBadge';
import { Clock, AlertCircle } from 'lucide-react';
import type { Activity } from '~/types/crm';
import { cn } from '~/lib/utils';

interface ActivityCardProps {
  activity: Activity;
  workspaceId: string;
  className?: string;
}

export function ActivityCard({ activity, workspaceId, className }: ActivityCardProps) {
  const isOverdue = activity.dueDate &&
    activity.status !== 'completed' &&
    activity.status !== 'cancelled' &&
    new Date(activity.dueDate) < new Date();

  // Call/meeting fields may be in metadata JSONB — fallback to metadata
  const meta = (activity.metadata || {}) as Record<string, any>;
  const callDuration = activity.callDuration || meta.callDuration || null;
  const meetingStartTime = activity.meetingStartTime || meta.meetingStartTime || null;
  const meetingEndTime = activity.meetingEndTime || meta.meetingEndTime || null;

  // Derive related entity from specific FK fields, falling back to legacy relatedToType/relatedToId
  let relatedEntityType: string | null = null;
  let relatedEntityId: string | null = null;
  if (activity.leadId) { relatedEntityType = 'lead'; relatedEntityId = activity.leadId; }
  else if (activity.contactId) { relatedEntityType = 'contact'; relatedEntityId = activity.contactId; }
  else if (activity.accountId) { relatedEntityType = 'account'; relatedEntityId = activity.accountId; }
  else if (activity.opportunityId) { relatedEntityType = 'opportunity'; relatedEntityId = activity.opportunityId; }
  else if (activity.relatedToType && activity.relatedToId) { relatedEntityType = activity.relatedToType; relatedEntityId = activity.relatedToId; }

  const entityPathMap: Record<string, string> = {
    lead: 'leads',
    contact: 'contacts',
    account: 'accounts',
    opportunity: 'opportunities',
  };
  const relatedEntityUrl = relatedEntityType && relatedEntityId
    ? `/dashboard/${workspaceId}/crm/${entityPathMap[relatedEntityType] || relatedEntityType + 's'}/${relatedEntityId}`
    : null;

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <Link
              to={`/dashboard/${workspaceId}/crm/activities/${activity.id}`}
              className="font-semibold hover:underline"
            >
              {activity.subject}
            </Link>
            {activity.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {activity.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <ActivityTypeBadge type={activity.type} />
          <ActivityStatusBadge status={activity.status} />
          <ActivityPriorityBadge priority={activity.priority} />
        </div>

        {/* Due Date */}
        {activity.dueDate && (
          <div className={cn(
            'flex items-center gap-2 text-sm',
            isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
          )}>
            {isOverdue ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span>
              {isOverdue ? 'Overdue: ' : 'Due: '}
              {format(new Date(activity.dueDate), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
        )}

        {/* Meeting Time */}
        {activity.type === 'meeting' && meetingStartTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(meetingStartTime), 'MMM d, yyyy h:mm a')}
              {meetingEndTime && (
                <> - {format(new Date(meetingEndTime), 'h:mm a')}</>
              )}
            </span>
          </div>
        )}

        {/* Call Duration */}
        {activity.type === 'call' && callDuration && (
          <div className="text-sm text-muted-foreground">
            Duration: {Math.floor(Number(callDuration) / 60)}m {Number(callDuration) % 60}s
          </div>
        )}

        {/* Related Entity */}
        {relatedEntityUrl && relatedEntityType && (
          <div className="text-sm">
            <span className="text-muted-foreground">Related to: </span>
            <Link
              to={relatedEntityUrl}
              className="text-primary hover:underline capitalize"
            >
              {relatedEntityType}
            </Link>
          </div>
        )}

        {/* Completed At */}
        {(activity.completedDate || activity.completedAt) && (
          <div className="text-sm text-muted-foreground">
            Completed: {format(new Date((activity.completedDate || activity.completedAt)!), 'MMM d, yyyy h:mm a')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
