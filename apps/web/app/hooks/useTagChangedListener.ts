/**
 * Hook to listen for tag_changed events
 * Shows toast notification and invalidates queries when tags change
 *
 * Note: This hooks into the shared SSE stream that's already established
 * by useSharedSSE for hook_events. We simply listen for specific event types
 * that indicate tags have changed.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TagChangedEvent {
  event_name?: string;
  eventName?: string;
  payload?: {
    new_tags?: string[];
    old_tags?: string[];
  };
}

export function useTagChangedListener(events: any[] = []) {
  const queryClient = useQueryClient();
  const processedEventIds = useRef(new Set<string>());

  useEffect(() => {
    // Look for tag_changed events in the latest events
    for (const event of events) {
      const eventData = event as TagChangedEvent & { id?: string };
      const eventName = eventData.event_name || eventData.eventName;
      const eventId = eventData.id;

      // Skip if we've already processed this event
      if (eventId && processedEventIds.current.has(eventId)) {
        continue;
      }

      if (eventName === 'tag_changed') {
        const payload = eventData.payload || {};
        const newTags = payload.new_tags || [];
        const oldTags = payload.old_tags || [];

        // Show toast notification
        if (newTags.length > 0) {
          toast.info(
            `Tags updated to [${newTags.join(', ')}]`,
            {
              description: oldTags.length > 0
                ? `Previously: [${oldTags.join(', ')}]`
                : undefined,
            }
          );
        } else {
          toast.info('Tags cleared');
        }

        // Refresh tags list
        queryClient.invalidateQueries({ queryKey: ['tags'] });

        // Mark event as processed
        if (eventId) {
          processedEventIds.current.add(eventId);

          // Clean up old event IDs (keep only last 100)
          if (processedEventIds.current.size > 100) {
            const ids = Array.from(processedEventIds.current);
            processedEventIds.current = new Set(ids.slice(-100));
          }
        }
      }
    }
  }, [events, queryClient]);
}
