/**
 * SDLC Board Detail Route
 * Shows individual board with stories and session info
 * Epic 2 Implementation - Epic 4 will add session relationships
 */

import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { BoardLockStatus } from "../components/sdlc/BoardLockStatus";
import { SessionStatusBadge } from "../components/sdlc/SessionStatusBadge";
import { SkeletonLoader } from "../components/sdlc/SkeletonLoader";
import { ErrorState } from "../components/sdlc/ErrorState";
import { ArrowLeft, Boxes, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import type { Board } from "../components/sdlc/BoardsTable";
import type { Session } from "../components/sdlc/SessionsTable";

export default function BoardDetailRoute() {
  const { boardId } = useParams();

  const { data: board, isLoading, error, refetch } = useQuery<Board>({
    queryKey: ['sdlc', 'boards', boardId],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/api/v1/sdlc/boards');
      if (!response.ok) {
        throw new Error('Failed to fetch board details');
      }
      const data = await response.json();
      const foundBoard = data.boards.find((b: Board) => b.board_id === boardId);
      if (!foundBoard) {
        throw new Error(`Board ${boardId} not found`);
      }
      return foundBoard;
    },
    refetchInterval: 10000,
  });

  // Fetch sessions working on this board
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: Session[] }>({
    queryKey: ['board-sessions', boardId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3000/api/v1/sdlc/boards/${boardId}/sessions`);
      if (!response.ok) {
        throw new Error('Failed to fetch board sessions');
      }
      return response.json();
    },
    refetchInterval: 10000,
    enabled: !!boardId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <SkeletonLoader variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <ErrorState
          title="Failed to load board"
          message={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/claude/sdlc/boards">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Boards
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Boxes className="h-8 w-8" />
            {board.name}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {board.board_id}
          </p>
        </div>
      </div>

      {/* Lock Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Lock Status</CardTitle>
          <CardDescription>Current board lock information</CardDescription>
        </CardHeader>
        <CardContent>
          <BoardLockStatus
            locked={board.locked}
            lock_owner={board.lock_owner}
            locked_at={board.locked_at}
            last_heartbeat={board.last_heartbeat}
            is_stale={board.is_stale}
          />
        </CardContent>
      </Card>

      {/* Sprint Information */}
      {board.sprint && (
        <Card>
          <CardHeader>
            <CardTitle>Sprint {board.sprint.number}: {board.sprint.name}</CardTitle>
            <CardDescription>Sprint goal and progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Sprint Goal</div>
              <p className="text-sm text-muted-foreground">{board.sprint.goal}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium mb-1">Start Date</div>
                <p className="text-sm text-muted-foreground">
                  {new Date(board.sprint.start_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">End Date</div>
                <p className="text-sm text-muted-foreground">
                  {new Date(board.sprint.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Progress</div>
                <Badge variant="outline">
                  {board.sprint.completed_points}/{board.sprint.total_points} pts
                </Badge>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{
                    width: `${(board.sprint.completed_points / board.sprint.total_points) * 100}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Working on This Board */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sessions Working on This Board
          </CardTitle>
          <CardDescription>
            Active sessions currently or recently working on this board
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <SkeletonLoader variant="table" />
          ) : sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Current Story</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsData.sessions.map((session) => (
                  <TableRow key={session.session_id}>
                    <TableCell className="font-mono text-sm">
                      {session.session_id}
                    </TableCell>
                    <TableCell>
                      <SessionStatusBadge status={session.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {session.last_heartbeat
                          ? formatDistanceToNow(new Date(session.last_heartbeat), { addSuffix: true })
                          : 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.current_story ? (
                        <Badge variant="default">{session.current_story}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/claude/sdlc/sessions/${session.session_id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sessions currently working on this board</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
