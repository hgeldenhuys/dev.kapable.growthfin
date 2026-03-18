/**
 * SDLC Session Detail Route
 * Shows individual session with detailed information
 * Epic 2 Implementation - Epic 4 will add board relationships
 */

import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SessionStatusBadge } from "../components/sdlc/SessionStatusBadge";
import { SkeletonLoader } from "../components/sdlc/SkeletonLoader";
import { ErrorState } from "../components/sdlc/ErrorState";
import { ArrowLeft, Activity, Clock, Boxes, FileText, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import type { Session } from "../components/sdlc/SessionsTable";

interface SessionsResponse {
  sessions: Session[];
}

export default function SessionDetailRoute() {
  const { sessionId } = useParams();

  const { data, isLoading, error, refetch } = useQuery<Session>({
    queryKey: ['sdlc', 'sessions', sessionId],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/api/v1/sdlc/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch session details');
      }
      const sessionsData: SessionsResponse = await response.json();
      const foundSession = sessionsData.sessions.find((s) => s.session_id === sessionId);
      if (!foundSession) {
        throw new Error(`Session ${sessionId} not found`);
      }
      return foundSession;
    },
    refetchInterval: 10000,
  });

  // Fetch boards this session is working on
  interface BoardInfo {
    id: string;
    name: string;
    lockedAt?: string;
    workedAt?: string;
  }

  interface SessionBoardsData {
    current: BoardInfo | null;
    history: BoardInfo[];
  }

  const { data: boardsData, isLoading: boardsLoading } = useQuery<SessionBoardsData>({
    queryKey: ['session-boards', sessionId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3000/api/v1/sdlc/sessions/${sessionId}/boards`);
      if (!response.ok) {
        throw new Error('Failed to fetch session boards');
      }
      return response.json();
    },
    refetchInterval: 10000,
    enabled: !!sessionId,
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
          title="Failed to load session"
          message={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const session = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/claude/sdlc/sessions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8" />
            Session Details
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {session.session_id}
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Session Status</CardTitle>
          <CardDescription>Current health and activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Health Status</div>
            <SessionStatusBadge status={session.status} />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Last Activity</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDistanceToNow(new Date(session.last_heartbeat), { addSuffix: true })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Heartbeat Time</div>
            <div className="text-sm text-muted-foreground font-mono">
              {new Date(session.last_heartbeat).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Work Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Work</CardTitle>
          <CardDescription>Active boards and stories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Locked Boards</div>
            {session.boards_locked.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {session.boards_locked.map((board) => (
                  <Badge key={board} variant="outline" className="flex items-center gap-2">
                    <Boxes className="h-3 w-3" />
                    {board}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No boards currently locked</p>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Current Story</div>
            {session.current_story ? (
              <Badge variant="default" className="flex items-center gap-2 w-fit">
                <FileText className="h-3 w-3" />
                {session.current_story}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">No active story</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checkpoint Data */}
      {session.checkpoint && (
        <Card>
          <CardHeader>
            <CardTitle>Session Checkpoint</CardTitle>
            <CardDescription>
              Last saved state from {new Date(session.checkpoint.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.checkpoint.stories_completed && session.checkpoint.stories_completed.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Completed Stories</div>
                <div className="flex flex-wrap gap-2">
                  {session.checkpoint.stories_completed.map((story) => (
                    <Badge key={story} variant="secondary">
                      {story}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {session.checkpoint.stories_in_progress && session.checkpoint.stories_in_progress.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">In Progress Stories</div>
                <div className="flex flex-wrap gap-2">
                  {session.checkpoint.stories_in_progress.map((story) => (
                    <Badge key={story} variant="outline">
                      {story}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {session.checkpoint.board_state_snapshot?.metrics && (
              <div>
                <div className="text-sm font-medium mb-2">Board Metrics</div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="border rounded p-3">
                    <div className="text-xs text-muted-foreground">Total Stories</div>
                    <div className="text-xl font-bold">
                      {session.checkpoint.board_state_snapshot.metrics.total_stories}
                    </div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-xs text-muted-foreground">Completed</div>
                    <div className="text-xl font-bold text-green-600">
                      {session.checkpoint.board_state_snapshot.metrics.completed}
                    </div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-xs text-muted-foreground">Velocity</div>
                    <div className="text-xl font-bold">
                      {session.checkpoint.board_state_snapshot.metrics.velocity}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Boards This Session Is Working On */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Boards This Session Is Working On
          </CardTitle>
          <CardDescription>
            Current and historical board work for this session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {boardsLoading ? (
            <SkeletonLoader variant="card" />
          ) : (
            <>
              {/* Current Board */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Current Board</h3>
                {boardsData?.current ? (
                  <Card className="border-2 border-blue-200 dark:border-blue-900">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Boxes className="h-5 w-5 text-blue-600" />
                            <h4 className="text-lg font-semibold">
                              {boardsData.current.name || boardsData.current.id}
                            </h4>
                          </div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {boardsData.current.id}
                          </div>
                          {boardsData.current.lockedAt && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              Locked {formatDistanceToNow(new Date(boardsData.current.lockedAt), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                        <Link to={`/claude/sdlc/boards/${boardsData.current.id}`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Board
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Boxes className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Not currently working on any board</p>
                  </div>
                )}
              </div>

              {/* Board History */}
              {boardsData?.history && boardsData.history.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Board History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Board Name</TableHead>
                        <TableHead>Board ID</TableHead>
                        <TableHead>Worked At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boardsData.history.map((board) => (
                        <TableRow key={board.id}>
                          <TableCell className="font-medium">{board.name || board.id}</TableCell>
                          <TableCell className="font-mono text-sm">{board.id}</TableCell>
                          <TableCell className="text-sm">
                            {board.workedAt
                              ? formatDistanceToNow(new Date(board.workedAt), { addSuffix: true })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Link to={`/claude/sdlc/boards/${board.id}`}>
                              <Button variant="outline" size="sm">
                                View Board
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
