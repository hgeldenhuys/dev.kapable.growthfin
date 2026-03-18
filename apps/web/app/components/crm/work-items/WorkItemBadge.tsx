/**
 * Work Item Badge Component (UI-001)
 * Displays pending work item count in navigation sidebar
 * Subscribes to SSE for real-time updates
 */

import { useEffect, useState, useRef } from 'react';
import { Badge } from '~/components/ui/badge';
import { useWorkspaceId } from '~/hooks/useWorkspace';

interface WorkItemBadgeProps {
  className?: string;
}

/**
 * Navigation badge showing pending work items count
 * Updates in real-time via SSE subscription
 */
export function WorkItemBadge({ className }: WorkItemBadgeProps) {
  const workspaceId = useWorkspaceId();
  const [count, setCount] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    // Fetch initial count
    const fetchCount = async () => {
      try {
        const params = new URLSearchParams({
          workspaceId,
          status: 'pending',
          limit: '1', // We just need the total count
        });

        const response = await fetch(`/api/v1/work-items?${params}`);
        if (response.ok) {
          const data = await response.json();
          setCount(data.total || 0);
        }
      } catch (error) {
        console.error('[WorkItemBadge] Failed to fetch count:', error);
      }
    };

    fetchCount();

    // Subscribe to SSE for real-time updates
    const streamUrl = `/api/v1/work-items/stream?workspaceId=${workspaceId}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      // Re-fetch count on any work item change
      if (event.data && !event.data.startsWith(':')) {
        fetchCount();
      }
    };

    eventSource.onerror = () => {
      // Connection error - will auto-reconnect
      console.warn('[WorkItemBadge] SSE connection error');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [workspaceId]);

  // Don't render if no count or count is 0
  if (count === null || count === 0) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className={`ml-auto font-mono text-xs ${className || ''}`}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
