/**
 * Context Usage Dashboard
 * US-CTX-007: Create Dashboard Route & Navigation for Context Usage
 * US-CTX-008: Session List with Progress Indicators
 * US-CTX-010: SSE Real-time Updates Hook for Web Dashboard
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { SessionCard } from "../components/context/SessionCard";
import { UsageGraph } from "../components/context/UsageGraph";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Activity, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

interface SessionMetrics {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  percentageUsed: number;
}

interface Session {
  sessionId: string;
  projectId: string;
  lastActivity: string;
  metrics: SessionMetrics;
  conversationTurns: number;
}

interface SessionsResponse {
  sessions: Session[];
  summary: {
    totalSessions: number;
    avgTokensPerSession: number;
    cacheHitRate: number;
  };
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function ContextUsagePage() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // TanStack Query for initial load
  const { data, isLoading, error } = useQuery<SessionsResponse>({
    queryKey: ["context-usage", "recent"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/context-usage/recent`);
      if (!response.ok) {
        throw new Error(`Failed to fetch context usage: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (data stays fresh via SSE)
    // Removed refetchInterval - using SSE for real-time updates
  });

  // SSE for real-time updates
  useEffect(() => {
    // Only run on client side and when we have data
    if (typeof window === 'undefined' || !data) return;

    // Use first session's projectId or fallback
    const projectId = data.sessions[0]?.projectId || 'agios';
    const url = `${API_URL}/api/v1/context-usage/stream?projectId=${projectId}`;

    console.log('[context-usage] Connecting to SSE stream:', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[context-usage] SSE connection established');
      setIsConnected(true);
    };

    eventSource.addEventListener('context_update', (e) => {
      try {
        const event = JSON.parse(e.data);
        const { sessionId, metrics } = event.data;

        console.log('[context-usage] Received context_update:', sessionId, metrics);

        // Update query cache
        queryClient.setQueryData<SessionsResponse>(
          ['context-usage', 'recent'],
          (oldData) => {
            if (!oldData) return oldData;

            const sessions = [...oldData.sessions];
            const index = sessions.findIndex(s => s.sessionId === sessionId);

            if (index >= 0) {
              // Update existing session
              sessions[index] = {
                ...sessions[index],
                metrics: {
                  ...sessions[index].metrics,
                  ...metrics,
                },
                lastActivity: new Date().toISOString(),
              };
            } else {
              // Add new session
              sessions.unshift({
                sessionId,
                projectId: event.data.projectId,
                lastActivity: new Date().toISOString(),
                metrics,
                conversationTurns: 1,
              });
            }

            return { ...oldData, sessions };
          }
        );
      } catch (error) {
        console.error('[context-usage] Error parsing SSE event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('[context-usage] SSE connection error:', error);
      setIsConnected(false);
    };

    return () => {
      console.log('[context-usage] Closing SSE connection');
      eventSource.close();
      setIsConnected(false);
    };
  }, [data, queryClient]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8" />
            Context Usage
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor token usage and context limits across all Claude Code sessions
          </p>
        </div>
        {/* Connection Status Indicator */}
        <div>
          {isConnected ? (
            <Badge variant="success" className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
              Live
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
              Disconnected
            </Badge>
          )}
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Dashboard updates in real-time via SSE when new context usage events occur. Token usage is
          color-coded: <span className="text-green-600 dark:text-green-400">green (&lt;75%)</span>,{" "}
          <span className="text-yellow-600 dark:text-yellow-400">yellow (75-89%)</span>,{" "}
          <span className="text-red-600 dark:text-red-400">red (≥90%)</span>.
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      {data?.summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data.summary.totalSessions}</div>
              <p className="text-xs text-muted-foreground">Total Sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {(data.summary.avgTokensPerSession / 1000).toFixed(1)}k
              </div>
              <p className="text-xs text-muted-foreground">Avg Tokens/Session</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data.summary.cacheHitRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Cache Hit Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 space-y-4">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Failed to load sessions</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error occurred"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Graph */}
      {data?.sessions && data.sessions.length > 0 && (
        <UsageGraph sessions={data.sessions} />
      )}

      {/* Sessions Grid */}
      {data?.sessions && data.sessions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Active Sessions ({data.sessions.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                sessionId={session.sessionId}
                projectId={session.projectId}
                lastActivity={session.lastActivity}
                metrics={session.metrics}
                conversationTurns={session.conversationTurns}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {data?.sessions && data.sessions.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Sessions</h3>
            <p className="text-muted-foreground">
              No context usage data available. Start a Claude Code session to see statistics here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
