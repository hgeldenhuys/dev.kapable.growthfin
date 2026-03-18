/**
 * TimelineView Component
 * Full timeline view with infinite scroll, filtering, and manual note creation
 */

import { useState } from 'react';
import { Plus, Loader2, Filter, X } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { TimelineEventCard } from './TimelineEventCard';
import {
  useInfiniteTimeline,
  useCreateTimelineEvent,
  useDeleteTimelineEvent,
} from '~/hooks/useTimeline';
import { toast } from 'sonner';
import type { CreateTimelineEventRequest, TimelineFilters } from '~/types/crm';

interface TimelineViewProps {
  workspaceId: string;
  entityType: 'lead' | 'contact' | 'account' | 'opportunity';
  entityId: string;
  userId: string;
}

export function TimelineView({
  workspaceId,
  entityType,
  entityId,
  userId,
}: TimelineViewProps) {
  // Filters
  const [filters, setFilters] = useState<TimelineFilters>({});
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all');

  // Dialogs
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDescription, setNoteDescription] = useState('');

  // Data
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteTimeline({
    workspaceId,
    entityType,
    entityId,
    filters,
  });

  const createEvent = useCreateTimelineEvent();
  const deleteEvent = useDeleteTimelineEvent();

  // Flatten pages
  const events = data?.pages.flatMap((page) => page.events) || [];

  // Apply filters
  const applyFilters = () => {
    const newFilters: TimelineFilters = {};

    if (eventTypeFilter !== 'all') {
      newFilters.eventTypes = [eventTypeFilter];
    }

    if (actorTypeFilter !== 'all') {
      newFilters.actorTypes = [actorTypeFilter as 'user' | 'system'];
    }

    setFilters(newFilters);
  };

  const clearFilters = () => {
    setEventTypeFilter('all');
    setActorTypeFilter('all');
    setFilters({});
  };

  const hasActiveFilters = eventTypeFilter !== 'all' || actorTypeFilter !== 'all';

  // Create note
  const handleCreateNote = async () => {
    if (!noteTitle.trim()) {
      toast.error('Error', { description: 'Please enter a note title' });
      return;
    }

    try {
      const noteData: CreateTimelineEventRequest = {
        workspaceId,
        entityType,
        entityId,
        title: noteTitle,
        description: noteDescription || undefined,
        actorId: userId,
        actorType: 'user',
        eventType: 'note_added',
      };

      await createEvent.mutateAsync(noteData);

      toast.success('Note added', { description: 'Your note has been added to the timeline.' });

      setNoteDialogOpen(false);
      setNoteTitle('');
      setNoteDescription('');
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Delete event
  const handleDeleteEvent = async () => {
    if (!selectedEventId) return;

    try {
      await deleteEvent.mutateAsync({
        eventId: selectedEventId,
        workspaceId,
      });

      toast.success('Event deleted', { description: 'The timeline event has been deleted.' });

      setDeleteDialogOpen(false);
      setSelectedEventId(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading timeline: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Timeline</h2>
          <p className="text-muted-foreground">
            Complete interaction history • {events.length} events
          </p>
        </div>
        <Button onClick={() => setNoteDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Note
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="stage_changed">Stage Changed</SelectItem>
                <SelectItem value="status_changed">Status Changed</SelectItem>
                <SelectItem value="note_added">Notes</SelectItem>
                <SelectItem value="email_sent">Email</SelectItem>
                <SelectItem value="call_made">Calls</SelectItem>
                <SelectItem value="meeting_scheduled">Meetings</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actorTypeFilter} onValueChange={setActorTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Actor Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actors</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={applyFilters} variant="secondary">
              Apply Filters
            </Button>

            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" size="icon">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex gap-2 mt-4">
              {eventTypeFilter !== 'all' && (
                <Badge variant="secondary">
                  Event: {eventTypeFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2"
                    onClick={() => setEventTypeFilter('all')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {actorTypeFilter !== 'all' && (
                <Badge variant="secondary">
                  Actor: {actorTypeFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2"
                    onClick={() => setActorTypeFilter('all')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Events */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters
                ? 'No events match your filters'
                : 'No timeline events yet'}
            </p>
            <Button onClick={() => setNoteDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <TimelineEventCard
              key={event.id}
              event={event}
              workspaceId={workspaceId}
              onDelete={() => {
                setSelectedEventId(event.id);
                setDeleteDialogOpen(true);
              }}
            />
          ))}

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a manual note to the timeline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Enter note title..."
              />
            </div>

            <div>
              <Label htmlFor="note-description">Description (Optional)</Label>
              <Textarea
                id="note-description"
                value={noteDescription}
                onChange={(e) => setNoteDescription(e.target.value)}
                placeholder="Enter note details..."
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNoteDialogOpen(false);
                setNoteTitle('');
                setNoteDescription('');
              }}
              disabled={createEvent.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={createEvent.isPending}>
              {createEvent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timeline event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
