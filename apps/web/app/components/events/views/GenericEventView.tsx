/**
 * GenericEventView Component
 *
 * Fallback view for event types that don't have custom views yet
 */

import { Info, Wrench, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { HookEvent } from '~/hooks/useHookEvent';

interface GenericEventViewProps {
  event: HookEvent;
}

export function GenericEventView({ event }: GenericEventViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          Event Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-md space-y-3">
          <div className="flex items-start gap-2">
            <div className="mt-1">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{event.eventName}</p>
              {event.toolName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  <span className="font-mono">{event.toolName}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{new Date(event.payload.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
          <p>This event type doesn't have a custom view yet.</p>
          <p className="text-xs mt-1">Check the Raw JSON Payload below for full details.</p>
        </div>

        {/* Display event-specific data if available */}
        {event.payload.event && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Event Data</p>
            <div className="text-xs space-y-1 bg-muted/30 p-3 rounded-md font-mono">
              {Object.entries(event.payload.event)
                .filter(([key]) => !['session_id', 'transcript_path', 'cwd', 'hook_event_name'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground min-w-[120px]">{key}:</span>
                    <span className="break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Import Activity icon
function Activity({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
