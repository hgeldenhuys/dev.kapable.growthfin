/**
 * ActivityTimelineItem Component
 * Individual activity card for timeline
 */

import { useState } from 'react';
import { Phone, Mail, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { CallTranscript } from '~/components/crm/voice/CallTranscript';
import type { LeadDetailActivity } from '~/hooks/useLeadDetail';

interface ActivityTimelineItemProps {
  activity: LeadDetailActivity;
}

export function ActivityTimelineItem({ activity }: ActivityTimelineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // H.4 - Check if call has recording/transcription
  const hasRecording = activity.type === 'call' && activity.recording;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'email':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'meeting':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'note':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0">
      <div className="flex-shrink-0">
        <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
          {getActivityIcon(activity.type)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
          </Badge>
          {activity.disposition && (
            <span className="text-xs text-muted-foreground">
              • {activity.disposition}
            </span>
          )}
          {activity.duration && (
            <span className="text-xs text-muted-foreground">
              • {formatDuration(activity.duration)}
            </span>
          )}
        </div>
        {activity.notes && (
          <p className="text-sm text-foreground mb-2 whitespace-pre-wrap">
            {activity.notes}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelativeTime(activity.createdAt)}</span>
          <span>•</span>
          <span>{activity.createdBy}</span>
        </div>

        {/* H.4 - Recording/Transcription toggle for call activities */}
        {hasRecording && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-1 h-7 px-2 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide Recording
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  View Recording
                </>
              )}
            </Button>
          </div>
        )}

        {/* H.4 - Call transcript display */}
        {hasRecording && isExpanded && (
          <div className="mt-3 pt-3 border-t">
            <CallTranscript
              recording={activity.recording!}
              transcription={activity.transcription || undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
