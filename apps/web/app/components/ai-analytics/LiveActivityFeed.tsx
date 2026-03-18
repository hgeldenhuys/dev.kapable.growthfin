/**
 * Live Activity Feed Component
 * Real-time feed of tool invocations using SSE
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AnalyticsEvent {
  type: 'tool_invocation';
  data: {
    toolName: string;
    status: string;
    duration: number;
    timestamp: string;
  };
}

interface LiveActivityFeedProps {
  workspaceId: string;
}

export function LiveActivityFeed({ workspaceId }: LiveActivityFeedProps) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/ai/analytics/stream`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [data, ...prev].slice(0, 50)); // Keep last 50
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setIsConnected(false);
      setError('Connection lost. Attempting to reconnect...');
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [workspaceId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
            {error}
          </div>
        )}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Waiting for activity...
            </div>
          ) : (
            events.map((event, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 border rounded hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{event.data.toolName}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(event.data.timestamp), 'HH:mm:ss')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {event.data.duration}ms
                  </span>
                  <Badge
                    className={
                      event.data.status === 'success'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }
                  >
                    {event.data.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
