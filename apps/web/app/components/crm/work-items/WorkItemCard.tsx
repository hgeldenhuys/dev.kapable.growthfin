/**
 * Work Item Card Component (UI-001)
 * Main card for displaying a work item with status, provenance, and actions
 */

import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Calendar, AlertTriangle } from 'lucide-react';
import { WorkItemStatusBadge } from './WorkItemStatusBadge';
import { WorkItemProvenanceBadge } from './WorkItemProvenanceBadge';
import { WorkItemQuickActions } from './WorkItemQuickActions';
import type { WorkItem } from '@agios/db';

interface WorkItemCardProps {
  workItem: WorkItem;
  workspaceId: string;
  userId?: string;
  onRefresh?: () => void;
  /** Compact variant for embedded panels vs full variant for list view */
  variant?: 'compact' | 'full';
  /** Whether clicking navigates to detail page */
  clickable?: boolean;
  className?: string;
}

// Format work item type for display
function formatWorkItemType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Format entity type for display
function formatEntityType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// Format due date with urgency indicator
function formatDueDate(dueAt: string | Date | null): { text: string; isOverdue: boolean; isUrgent: boolean } {
  if (!dueAt) {
    return { text: '', isOverdue: false, isUrgent: false };
  }

  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const isOverdue = diffMs < 0;
  const isUrgent = diffHours > 0 && diffHours < 24; // Due within 24 hours

  const text = due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return { text, isOverdue, isUrgent };
}

// Priority indicator
function PriorityIndicator({ priority }: { priority: number }) {
  if (priority <= 0) return null;

  const colors =
    priority >= 80 ? 'bg-red-500' :
    priority >= 50 ? 'bg-orange-500' :
    priority >= 30 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div
      className={`w-1.5 h-full absolute left-0 top-0 rounded-l ${colors}`}
      title={`Priority: ${priority}`}
    />
  );
}

export function WorkItemCard({
  workItem,
  workspaceId,
  userId,
  onRefresh,
  variant = 'full',
  clickable = true,
  className,
}: WorkItemCardProps) {
  const navigate = useNavigate();
  const dueInfo = formatDueDate(workItem.dueAt);

  const handleClick = () => {
    if (clickable) {
      navigate(`/dashboard/${workspaceId}/work-items/${workItem.id}`);
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className={`relative p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
          clickable ? 'cursor-pointer' : ''
        } ${className || ''}`}
        onClick={handleClick}
      >
        <PriorityIndicator priority={workItem.priority} />

        <div className="flex items-start justify-between gap-2 ml-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{workItem.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <WorkItemStatusBadge status={workItem.status} size="sm" />
              <span className="text-xs text-muted-foreground">
                {formatWorkItemType(workItem.workItemType)}
              </span>
            </div>
          </div>

          <WorkItemQuickActions
            workItem={workItem}
            workspaceId={workspaceId}
            userId={userId}
            onRefresh={onRefresh}
            compact
          />
        </div>

        {/* Due date */}
        {dueInfo.text && (
          <div className={`flex items-center gap-1 mt-2 ml-2 text-xs ${
            dueInfo.isOverdue ? 'text-red-600' :
            dueInfo.isUrgent ? 'text-orange-600' : 'text-muted-foreground'
          }`}>
            {(dueInfo.isOverdue || dueInfo.isUrgent) && (
              <AlertTriangle className="h-3 w-3" />
            )}
            <Calendar className="h-3 w-3" />
            <span>{dueInfo.isOverdue ? 'Overdue: ' : ''}{dueInfo.text}</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card
      className={`relative overflow-hidden hover:shadow-md transition-shadow ${
        clickable ? 'cursor-pointer' : ''
      } ${className || ''}`}
      onClick={handleClick}
    >
      <PriorityIndicator priority={workItem.priority} />

      <CardHeader className="pb-2 ml-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{workItem.title}</CardTitle>
            {workItem.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {workItem.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <WorkItemStatusBadge status={workItem.status} />
            <WorkItemProvenanceBadge
              sourceType={workItem.sourceType}
              sourceId={workItem.sourceId}
              workspaceId={workspaceId}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 ml-2">
        {/* Metadata row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span>{formatWorkItemType(workItem.workItemType)}</span>
          <span className="text-border">|</span>
          <span>{formatEntityType(workItem.entityType)}</span>
          {workItem.priority > 0 && (
            <>
              <span className="text-border">|</span>
              <span className="font-mono">P{workItem.priority}</span>
            </>
          )}
        </div>

        {/* Due date */}
        {dueInfo.text && (
          <div className={`flex items-center gap-1 mb-3 text-sm ${
            dueInfo.isOverdue ? 'text-red-600 font-medium' :
            dueInfo.isUrgent ? 'text-orange-600' : 'text-muted-foreground'
          }`}>
            {(dueInfo.isOverdue || dueInfo.isUrgent) && (
              <AlertTriangle className="h-4 w-4" />
            )}
            <Calendar className="h-4 w-4" />
            <span>
              {dueInfo.isOverdue ? 'Overdue: ' : 'Due: '}
              {dueInfo.text}
            </span>
          </div>
        )}

        {/* Actions */}
        <div
          className="flex justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <WorkItemQuickActions
            workItem={workItem}
            workspaceId={workspaceId}
            userId={userId}
            onRefresh={onRefresh}
          />
        </div>
      </CardContent>
    </Card>
  );
}
