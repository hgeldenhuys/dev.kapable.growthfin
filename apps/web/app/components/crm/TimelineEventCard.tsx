/**
 * TimelineEventCard Component
 * Displays a single timeline event with expandable details
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  PlusCircle,
  Edit,
  ArrowRight,
  ToggleLeft,
  FileText,
  Mail,
  Phone,
  Calendar,
  User,
  Building2,
  Target,
  TrendingUp,
  MoreVertical,
  Trash,
  ChevronDown,
  ChevronUp,
  Pin,
  Tag,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import type { CRMTimelineEvent } from '~/types/crm';
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS } from '~/types/crm';
import { DataChangeRenderer } from './timeline/DataChangeRenderer';
import { CommunicationRenderer } from './timeline/CommunicationRenderer';
import { EventCategoryBadge } from './timeline/EventCategoryBadge';

interface TimelineEventCardProps {
  event: CRMTimelineEvent;
  workspaceId?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const EVENT_ICONS: Record<string, any> = {
  created: PlusCircle,
  updated: Edit,
  stage_changed: ArrowRight,
  status_changed: ToggleLeft,
  note_added: FileText,
  email_sent: Mail,
  call_made: Phone,
  meeting_scheduled: Calendar,
  // AI Call events
  'ai_call.initiated': Bot,
  'ai_call.completed': Bot,
  ai_call_initiated: Bot,
  ai_call_completed: Bot,
};

const ENTITY_ICONS: Record<string, any> = {
  lead: Target,
  contact: User,
  account: Building2,
  opportunity: TrendingUp,
};

export function TimelineEventCard({
  event,
  workspaceId,
  expanded: defaultExpanded = false,
  onToggle,
  onDelete,
  onEdit,
}: TimelineEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const EventIcon = EVENT_ICONS[event.eventType] || FileText;
  const EntityIcon = ENTITY_ICONS[event.entityType] || FileText;
  const borderColor = ENTITY_TYPE_COLORS[event.entityType] || 'gray';

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatAbsoluteTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get actor display name
  const getActorDisplayName = () => {
    if (event.actorName) return event.actorName;
    if (event.actorType === 'system') return 'System';
    if (event.actorType === 'integration') return 'Integration';
    return 'User';
  };

  // Get actor initials
  const getActorInitials = () => {
    if (event.actorName) {
      const parts = event.actorName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return event.actorName.substring(0, 2).toUpperCase();
    }
    if (event.actorType === 'system') return 'SY';
    if (event.actorType === 'integration') return 'IN';
    return 'U';
  };

  // Can edit/delete only manual notes
  const canModify = event.eventType === 'note_added';

  // Check if event has expandable content
  const hasExpandableContent =
    event.description ||
    (event.dataChanges && event.dataChanges.length > 0) ||
    event.communication ||
    (event.metadata && Object.keys(event.metadata).length > 0);

  return (
    <Card
      className={`relative overflow-hidden border-l-4 ${
        event.isPinned ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : ''
      }`}
      style={{
        borderLeftColor: `hsl(var(--${borderColor}))`,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Event Icon */}
          <div className="mt-1 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <EventIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Pin indicator and category badge */}
                <div className="flex items-center gap-2 mb-1">
                  {event.isPinned && (
                    <Pin className="h-3 w-3 text-yellow-600 fill-yellow-600" />
                  )}
                  <EventCategoryBadge category={event.eventCategory} />
                </div>

                {/* Event label/title */}
                <h4 className="font-medium text-sm">
                  {event.eventLabel || event.title}
                </h4>

                {/* Summary - prominently displayed */}
                {event.summary && event.summary !== event.title && event.summary !== event.eventLabel && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.summary}
                  </p>
                )}

                {/* Actor and timestamp */}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[8px]">
                      {getActorInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {getActorDisplayName()}
                  </span>
                  <span>•</span>
                  <span
                    title={formatAbsoluteTimestamp(event.occurredAt)}
                    className="cursor-help"
                  >
                    {formatTimestamp(event.occurredAt)}
                  </span>
                </div>

                {/* Tags */}
                {event.tags && event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {event.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-5"
                      >
                        <Tag className="h-2.5 w-2.5 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Entity Badge */}
                {workspaceId ? (
                  <Link
                    to={`/dashboard/${workspaceId}/crm/${event.entityType}s/${event.entityId}`}
                    className="flex-shrink-0"
                  >
                    <Badge variant="outline" className="gap-1">
                      <EntityIcon className="h-3 w-3" />
                      {ENTITY_TYPE_LABELS[event.entityType]}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <EntityIcon className="h-3 w-3" />
                    {ENTITY_TYPE_LABELS[event.entityType]}
                  </Badge>
                )}

                {/* Actions Menu */}
                {canModify && (onEdit || onDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && (
                        <DropdownMenuItem onClick={onEdit}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={onDelete}
                          className="text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Expand/Collapse */}
                {hasExpandableContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleToggle}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Data Changes - Always visible if present (not expandable) */}
            {event.dataChanges && event.dataChanges.length > 0 && (
              <DataChangeRenderer changes={event.dataChanges} />
            )}

            {/* AI Call Link - Always show if metadata has aiCallId */}
            {event.metadata?.aiCallId && workspaceId && (
              <div className="mt-3">
                <Link
                  to={`/dashboard/${workspaceId}/crm/ai-calls/${event.metadata.aiCallId}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Bot className="h-4 w-4" />
                  View AI Call Details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Expandable content */}
            {isExpanded && (
              <>
                {/* Communication Details */}
                {event.communication && (
                  <CommunicationRenderer communication={event.communication} />
                )}

                {/* Description */}
                {event.description && (
                  <div className="mt-3 text-sm text-muted-foreground border-t pt-3">
                    <p className="whitespace-pre-wrap">{event.description}</p>
                  </div>
                )}

                {/* Metadata (only if exists and not empty) */}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-3 text-xs border-t pt-3">
                    <div className="font-medium text-muted-foreground mb-2">
                      Additional Metadata
                    </div>
                    <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
