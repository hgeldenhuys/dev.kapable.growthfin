/**
 * ActivityTimeline Component
 * Full activity timeline with real-time SSE updates, filtering, and quick note input
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Clock, Phone, Mail, Calendar, FileText, Loader2 } from 'lucide-react';
import { ActivityTimelineItem } from './ActivityTimelineItem';
import { QuickNoteInput } from './QuickNoteInput';
import type { LeadDetailActivity } from '~/hooks/useLeadDetail';

// Client-side code MUST use proxy routes


interface ActivityTimelineProps {
  leadId: string;
  workspaceId: string;
  initialActivities?: LeadDetailActivity[];
}

type ActivityFilter = 'all' | 'call' | 'email' | 'note' | 'meeting';

export function ActivityTimeline({
  leadId,
  workspaceId,
  initialActivities = []
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<LeadDetailActivity[]>(initialActivities);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update activities when initialActivities prop changes
  useEffect(() => {
    if (initialActivities.length > 0) {
      setActivities(initialActivities);
    }
  }, [initialActivities]);

  // TODO: SSE real-time updates - endpoint not yet implemented
  // useEffect(() => {
  //   if (!leadId || !workspaceId) return;
  //
  //   const eventSource = new EventSource(
  //     `/api/v1/crm/leads/${leadId}/activities/stream?workspaceId=${workspaceId}`
  //   );
  //
  //   eventSource.onmessage = (event) => {
  //     try {
  //       const data = JSON.parse(event.data);
  //       if (data.type === 'activity_created') {
  //         setActivities((prev) => [data.activity, ...prev]);
  //       } else if (data.type === 'activity_updated') {
  //         setActivities((prev) =>
  //           prev.map((act) => (act.id === data.activity.id ? data.activity : act))
  //         );
  //       }
  //     } catch (err) {
  //       console.error('Failed to parse SSE event:', err);
  //     }
  //   };
  //
  //   eventSource.onerror = () => {
  //     console.error('SSE connection error');
  //     eventSource.close();
  //   };
  //
  //   return () => {
  //     eventSource.close();
  //   };
  // }, [leadId, workspaceId]);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `/api/v1/crm/leads/${leadId}/activities?workspaceId=${workspaceId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteAdded = (note: LeadDetailActivity) => {
    // Optimistic update - SSE will confirm
    setActivities((prev) => [note, ...prev]);
  };

  const filteredActivities = activities.filter((activity) => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  const filterButtons: Array<{ value: ActivityFilter; label: string; icon: any }> = [
    { value: 'all', label: 'All', icon: Clock },
    { value: 'call', label: 'Calls', icon: Phone },
    { value: 'email', label: 'Emails', icon: Mail },
    { value: 'note', label: 'Notes', icon: FileText },
    { value: 'meeting', label: 'Meetings', icon: Calendar },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Note Input */}
        <QuickNoteInput
          leadId={leadId}
          workspaceId={workspaceId}
          onNoteAdded={handleNoteAdded}
        />

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {filterButtons.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={filter === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(value)}
              className="flex items-center gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Activities List */}
        {!isLoading && !error && (
          <div className="space-y-3">
            {filteredActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No {filter !== 'all' ? filter : ''} activities yet
              </p>
            ) : (
              filteredActivities.map((activity) => (
                <ActivityTimelineItem key={activity.id} activity={activity} />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
