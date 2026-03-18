/**
 * SDLC Boards List Route
 * Displays all kanban boards with lock status
 * Migrated from dedicated page (Epic 2)
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { BoardsTable, Board } from "../components/sdlc/BoardsTable";
import { SkeletonLoader } from "../components/sdlc/SkeletonLoader";
import { ErrorState } from "../components/sdlc/ErrorState";
import { Boxes, Info } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

interface BoardsResponse {
  boards: Board[];
  total_boards: number;
  locked_boards: number;
  stale_locks: number;
}

export default function BoardsListRoute() {
  const { data, isLoading, error, refetch } = useQuery<BoardsResponse>({
    queryKey: ['sdlc', 'boards'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/api/v1/sdlc/boards');
      if (!response.ok) {
        throw new Error('Failed to fetch boards');
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
            <Boxes className="h-8 w-8" />
            Kanban Boards
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor board availability and manage locks
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Boards</CardDescription>
              <CardTitle className="text-3xl">{data.total_boards}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Available</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {data.total_boards - data.locked_boards}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Locked</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {data.locked_boards}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Stale Locks</CardDescription>
              <CardTitle className="text-3xl text-orange-600">
                {data.stale_locks}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Board locks prevent concurrent edits. Locks automatically expire after 5 minutes of inactivity.
          Hover over lock status for details.
        </AlertDescription>
      </Alert>

      {/* Boards Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Boards</CardTitle>
          <CardDescription>
            Kanban boards from .claude/sdlc/kanban/boards/
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonLoader />
          ) : error ? (
            <ErrorState
              title="Failed to load boards"
              message={error instanceof Error ? error.message : 'Unknown error'}
              onRetry={refetch}
            />
          ) : (
            <BoardsTable boards={data?.boards || []} />
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Lock Status Legend</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <span>🔓</span>
              <div>
                <div className="font-medium text-foreground">Available</div>
                <div className="text-xs">Board is unlocked and ready for work</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <div>
                <div className="font-medium text-foreground">Locked</div>
                <div className="text-xs">Board is locked by an active session</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <div>
                <div className="font-medium text-foreground">Stale Lock</div>
                <div className="text-xs">No heartbeat &gt; 5 minutes, can be taken over</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
