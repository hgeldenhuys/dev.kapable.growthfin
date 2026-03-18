/**
 * CRMTimeline Component
 * Reusable timeline component with infinite scroll and real-time updates
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Filter, Search, X, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { useInfiniteTimeline, useDeleteTimelineEvent } from '~/hooks/useTimeline';
import { toast } from 'sonner';
import { TimelineEventCard } from './TimelineEventCard';
import { AddTimelineNoteModal } from './AddTimelineNoteModal';
import type { TimelineFilters } from '~/types/crm';
import { TIMELINE_EVENT_TYPES, ENTITY_TYPE_LABELS } from '~/types/crm';

interface CRMTimelineProps {
  workspaceId: string;
  userId: string;
  entityType?: 'lead' | 'contact' | 'account' | 'opportunity';
  entityId?: string;
  showFilters?: boolean;
  showAddNote?: boolean;
  embedded?: boolean;
}

export function CRMTimeline({
  workspaceId,
  userId,
  entityType,
  entityId,
  showFilters = true,
  showAddNote = true,
  embedded = false,
}: CRMTimelineProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(!embedded);

  // Parse filters from URL
  const [filters, setFilters] = useState<TimelineFilters>(() => {
    const entityTypes = searchParams.get('entityTypes')?.split(',').filter(Boolean);
    const eventTypes = searchParams.get('eventTypes')?.split(',').filter(Boolean);
    const actorTypes = searchParams.get('actorTypes')?.split(',') as ('user' | 'system')[] | undefined;
    const search = searchParams.get('search') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    return {
      entityTypes,
      eventTypes,
      actorTypes,
      search,
      dateFrom,
      dateTo,
    };
  });

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  // Update URL when filters change
  useEffect(() => {
    if (!showFilters) return;

    const params = new URLSearchParams();
    if (filters.entityTypes && filters.entityTypes.length > 0) {
      params.set('entityTypes', filters.entityTypes.join(','));
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      params.set('eventTypes', filters.eventTypes.join(','));
    }
    if (filters.actorTypes && filters.actorTypes.length > 0) {
      params.set('actorTypes', filters.actorTypes.join(','));
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    if (filters.dateFrom) {
      params.set('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.set('dateTo', filters.dateTo);
    }

    setSearchParams(params, { replace: true });
  }, [filters, showFilters, setSearchParams]);

  // Fetch timeline with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteTimeline({
    workspaceId,
    entityType,
    entityId,
    filters,
  });

  const deleteEvent = useDeleteTimelineEvent();

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into single events array
  const events = data?.pages.flatMap((page) => page.events) || [];

  // Handle delete
  const handleDelete = async (eventId: string) => {
    try {
      await deleteEvent.mutateAsync({ eventId, workspaceId });
      toast.success('Note Deleted', { description: 'Timeline note deleted successfully' });
    } catch (error) {
      console.error('Failed to delete timeline event:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete note' });
    }
  };

  // Toggle filter
  const toggleFilter = (key: keyof TimelineFilters, value: string) => {
    setFilters((prev) => {
      const current = prev[key] as string[] | undefined;
      const newValue = current?.includes(value)
        ? current.filter((v) => v !== value)
        : [...(current || []), value];

      return { ...prev, [key]: newValue.length > 0 ? newValue : undefined };
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setSearchInput('');
  };

  // Count active filters
  const activeFilterCount =
    (filters.entityTypes?.length || 0) +
    (filters.eventTypes?.length || 0) +
    (filters.actorTypes?.length || 0) +
    (filters.search ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className={`font-semibold ${embedded ? 'text-lg' : 'text-2xl'}`}>
            {embedded ? 'Activity Timeline' : 'CRM Timeline'}
          </h2>
          {!embedded && (
            <p className="text-sm text-muted-foreground mt-1">
              View all CRM activity and interactions
            </p>
          )}
        </div>

        {showFilters && (
          <Button
            variant="outline"
            size={embedded ? 'sm' : 'default'}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Filters</CardTitle>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search timeline events..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {/* Entity Types */}
                  {!entityType && (
                    <div className="space-y-2">
                      <Label>Entity Types</Label>
                      <div className="space-y-2">
                        {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                          <div key={value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`entity-${value}`}
                              checked={filters.entityTypes?.includes(value)}
                              onCheckedChange={() => toggleFilter('entityTypes', value)}
                            />
                            <Label htmlFor={`entity-${value}`} className="font-normal">
                              {label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Event Types */}
                  <div className="space-y-2">
                    <Label>Event Types</Label>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {TIMELINE_EVENT_TYPES.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`event-${type.value}`}
                              checked={filters.eventTypes?.includes(type.value)}
                              onCheckedChange={() => toggleFilter('eventTypes', type.value)}
                            />
                            <Label htmlFor={`event-${type.value}`} className="font-normal">
                              {type.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Actor Types */}
                  <div className="space-y-2">
                    <Label>Actor Types</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="actor-user"
                          checked={filters.actorTypes?.includes('user')}
                          onCheckedChange={() => toggleFilter('actorTypes', 'user')}
                        />
                        <Label htmlFor="actor-user" className="font-normal">
                          User
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="actor-system"
                          checked={filters.actorTypes?.includes('system')}
                          onCheckedChange={() => toggleFilter('actorTypes', 'system')}
                        />
                        <Label htmlFor="actor-system" className="font-normal">
                          System
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Timeline Events */}
      <div className="space-y-3">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive">
                Failed to load timeline events. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Events List */}
        {!isLoading && !error && events.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No timeline events found</p>
              {showAddNote && (
                <AddTimelineNoteModal
                  workspaceId={workspaceId}
                  userId={userId}
                  defaultEntityType={entityType}
                  defaultEntityId={entityId}
                />
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && events.length > 0 && (
          <>
            {events.map((event) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                onDelete={
                  event.eventType === 'note_added'
                    ? () => handleDelete(event.id)
                    : undefined
                }
              />
            ))}

            {/* Load More Trigger */}
            <div ref={loadMoreRef} className="py-4 text-center">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more events...</span>
                </div>
              )}
              {!hasNextPage && events.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  No more events to load
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
