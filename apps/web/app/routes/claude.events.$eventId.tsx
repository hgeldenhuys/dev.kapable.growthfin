/**
 * Event Detail Route
 *
 * Displays detailed information about a specific hook event
 * Accessed via Telegram notification links: /claude/events/:eventId
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { EventDetailLayout } from '~/components/events/EventDetailLayout';
import { EventTypeRouter } from '~/components/events/EventTypeRouter';
import { useHookEvent } from '~/hooks/useHookEvent';

export default function EventDetail() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR, show loading state
  if (!isMounted) {
    return <EventDetailLoading />;
  }

  return <ClientOnlyEventDetail />;
}

function EventDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/claude/hooks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Loading Event...</h1>
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientOnlyEventDetail() {
  const { eventId } = useParams();
  const { data: event, isLoading, error } = useHookEvent(eventId);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/claude/hooks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Loading Event...</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/claude/hooks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Event Not Found</h1>
          </div>
        </div>
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Unable to load event</p>
                <p className="text-sm text-muted-foreground">
                  {error?.message || 'The event you\'re looking for doesn\'t exist or has been removed.'}
                </p>
                {eventId && (
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                    Event ID: {eventId}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/claude/hooks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Event Details</h1>
          <p className="text-sm text-muted-foreground">
            Hook event from session
          </p>
        </div>
      </div>

      {/* Event detail layout with type-specific view */}
      <EventDetailLayout event={event}>
        <EventTypeRouter event={event} />
      </EventDetailLayout>
    </div>
  );
}
