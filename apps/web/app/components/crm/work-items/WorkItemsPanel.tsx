/**
 * Work Items Panel Component (UI-001)
 * Embeddable panel for entity detail pages
 * Displays work items filtered by entity with SSE updates
 */

import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { ClipboardList, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { WorkItemCard } from './WorkItemCard';
import type { WorkItem, EntityType } from '@agios/db';

interface WorkItemsPanelProps {
  entityType: EntityType;
  entityId: string;
  workspaceId: string;
  userId?: string;
  /** Title override */
  title?: string;
  /** Show create button */
  showCreateButton?: boolean;
  /** Maximum items to show before "View All" */
  maxItems?: number;
  className?: string;
}

interface WorkItemsResponse {
  workItems: WorkItem[];
  total: number;
}

export function WorkItemsPanel({
  entityType,
  entityId,
  workspaceId,
  userId,
  title = 'Work Items',
  showCreateButton = false,
  maxItems = 5,
  className,
}: WorkItemsPanelProps) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch work items for this entity
  const { data, isLoading, isError, refetch } = useQuery<WorkItemsResponse>({
    queryKey: ['work-items', 'entity', entityType, entityId],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        entityType,
        entityId,
        limit: String(maxItems + 1), // Fetch one extra to know if there are more
      });

      const response = await fetch(`/api/v1/work-items?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch work items');
      }

      return response.json();
    },
    enabled: !!workspaceId && !!entityId,
    staleTime: 30000, // 30 seconds
  });

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!workspaceId || !entityId) return;

    const streamUrl = `/api/v1/work-items/stream?workspaceId=${workspaceId}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (event.data && !event.data.startsWith(':')) {
        try {
          const data = JSON.parse(event.data);
          // Only refetch if the event is for our entity
          if (data.entityType === entityType && data.entityId === entityId) {
            queryClient.invalidateQueries({
              queryKey: ['work-items', 'entity', entityType, entityId],
            });
          }
        } catch {
          // Invalid JSON, refetch anyway to be safe
          queryClient.invalidateQueries({
            queryKey: ['work-items', 'entity', entityType, entityId],
          });
        }
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [workspaceId, entityId, entityType, queryClient]);

  const workItems = data?.workItems || [];
  const total = data?.total || 0;
  const hasMore = total > maxItems;
  const displayItems = workItems.slice(0, maxItems);

  const handleCreateWorkItem = () => {
    // TODO: Open create work item dialog
    console.log('Create work item for', entityType, entityId);
  };

  const handleViewAll = () => {
    // Navigate to work items list filtered by entity
    window.location.href = `/dashboard/${workspaceId}/work-items?entityType=${entityType}&entityId=${entityId}`;
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">{title}</CardTitle>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">({total})</span>
          )}
          {isConnected && (
            <span className="h-2 w-2 rounded-full bg-green-500" title="Real-time updates active" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>

          {showCreateButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateWorkItem}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && workItems.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">Failed to load work items</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => refetch()}
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        ) : workItems.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No work items for this {entityType}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item) => (
              <WorkItemCard
                key={item.id}
                workItem={item}
                workspaceId={workspaceId}
                userId={userId}
                onRefresh={() => refetch()}
                variant="compact"
              />
            ))}

            {hasMore && (
              <div className="pt-2 border-t">
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleViewAll}
                  className="w-full"
                >
                  View all {total} work items
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
