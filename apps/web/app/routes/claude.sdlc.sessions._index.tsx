/**
 * SDLC Sessions List Route
 * Displays all active sessions with health indicators
 * Migrated from dedicated page (Epic 2)
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { SessionsTable, Session } from "../components/sdlc/SessionsTable";
import { SkeletonLoader } from "../components/sdlc/SkeletonLoader";
import { ErrorState } from "../components/sdlc/ErrorState";
import { Activity, Info } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

interface SessionsResponse {
  sessions: Session[];
}

export default function SessionsListRoute() {
  const { data, isLoading, error, refetch } = useQuery<SessionsResponse>({
    queryKey: ['sdlc', 'sessions'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/api/v1/sdlc/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      return response.json();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8" />
            Active Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor all Claude Code sessions across the codebase
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Sessions are automatically refreshed every 10 seconds. Click on a session to view detailed information.
        </AlertDescription>
      </Alert>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            All sessions from .claude/sdlc/kanban/sessions/
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonLoader />
          ) : error ? (
            <ErrorState
              title="Failed to load sessions"
              message={error instanceof Error ? error.message : 'Unknown error'}
              onRetry={refetch}
            />
          ) : (
            <SessionsTable sessions={data?.sessions || []} />
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Health Indicators</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <span>🟢</span>
              <div>
                <div className="font-medium text-foreground">Active</div>
                <div className="text-xs">Last heartbeat &lt; 1 minute ago</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>🟡</span>
              <div>
                <div className="font-medium text-foreground">Warning</div>
                <div className="text-xs">Last heartbeat 1-5 minutes ago</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>🔴</span>
              <div>
                <div className="font-medium text-foreground">Stale</div>
                <div className="text-xs">Last heartbeat &gt; 5 minutes ago</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>⚫</span>
              <div>
                <div className="font-medium text-foreground">Archived</div>
                <div className="text-xs">Session moved to archive</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
