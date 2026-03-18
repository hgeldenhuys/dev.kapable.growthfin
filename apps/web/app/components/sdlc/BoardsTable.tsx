/**
 * BoardsTable Component
 * Displays list of Kanban boards with lock status and actions
 */

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { BoardLockStatus } from "./BoardLockStatus";
import { BoardLockActions } from "./BoardLockActions";
import { CrashRecoveryDialog, StaleLock, CheckpointData } from "./CrashRecoveryDialog";
import { Badge } from "../ui/badge";
import { Boxes, Users } from "lucide-react";

export interface Board {
  board_id: string;
  name: string;
  locked: boolean;
  lock_owner: string | null;
  locked_at: string | null;
  last_heartbeat: string | null;
  is_stale: boolean;
  sprint?: {
    number: number;
    name: string;
    start_date: string;
    end_date: string;
    goal: string;
    total_points: number;
    completed_points: number;
  };
}

interface BoardsTableProps {
  boards: Board[];
}

/**
 * SessionCount Component
 * Fetches and displays session count for a board
 */
function SessionCount({ boardId }: { boardId: string }) {
  const { data } = useQuery({
    queryKey: ['board-sessions', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/sdlc/boards/${boardId}/sessions`);
      if (!response.ok) {
        throw new Error('Failed to fetch board sessions');
      }
      return response.json();
    },
    refetchInterval: 10000,
  });

  const sessionCount = data?.sessions?.length || 0;

  if (sessionCount === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <Users className="h-3 w-3 mr-1" />
        0 sessions
      </Badge>
    );
  }

  return (
    <Link to={`/claude/sdlc/boards/${boardId}`}>
      <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
        <Users className="h-3 w-3 mr-1" />
        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
      </Badge>
    </Link>
  );
}

export function BoardsTable({ boards }: BoardsTableProps) {
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [staleLock, setStaleLock] = useState<StaleLock | null>(null);
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(null);
  const [dismissedSessions, setDismissedSessions] = useState<Set<string>>(() => {
    // Load dismissed sessions from sessionStorage on mount
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('dismissedStaleSessions');
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  // Auto-detect stale locks on component mount or when boards change
  useEffect(() => {
    const staleBoard = boards.find((b) => b.is_stale && b.locked);

    if (staleBoard && !showRecoveryDialog) {
      const sessionId = staleBoard.lock_owner || "unknown";

      // Don't show dialog if user already dismissed this session
      if (dismissedSessions.has(sessionId)) {
        return;
      }

      // Create lock info from board data
      const lock: StaleLock = {
        session_id: sessionId,
        board_scope: staleBoard.board_id,
        locked_at: staleBoard.locked_at || new Date().toISOString(),
        heartbeat: staleBoard.last_heartbeat || new Date().toISOString(),
        stale_threshold_seconds: 300,
      };

      // Create checkpoint data (will be populated from board metadata)
      const checkpointData: CheckpointData = {
        stories_completed: [],
        stories_in_progress: [],
        last_updated: new Date().toISOString(),
      };

      setStaleLock(lock);
      setCheckpoint(checkpointData);
      setShowRecoveryDialog(true);
    }
  }, [boards, showRecoveryDialog, dismissedSessions]);

  if (boards.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <div className="text-muted-foreground">
          <Boxes className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No Boards Found</p>
          <p className="text-sm">
            No Kanban boards found in .claude/sdlc/kanban/boards/
          </p>
        </div>
      </div>
    );
  }

  const handleTakeover = (newSessionId: string) => {
    // Refresh the boards list after successful takeover
    console.log("[BoardsTable] Takeover successful, new session:", newSessionId);
    // The boards will be automatically refreshed by parent component's polling
  };

  const handleCancel = () => {
    console.log("[BoardsTable] User cancelled takeover");

    // Add the dismissed session to the list
    if (staleLock) {
      const newDismissed = new Set(dismissedSessions);
      newDismissed.add(staleLock.session_id);
      setDismissedSessions(newDismissed);

      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('dismissedStaleSessions', JSON.stringify(Array.from(newDismissed)));
        } catch (error) {
          console.error('[BoardsTable] Failed to save dismissed sessions:', error);
        }
      }
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Board Name</TableHead>
            <TableHead>Sprint</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Lock Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boards.map((board) => (
            <TableRow key={board.board_id}>
              {/* Board Name */}
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {board.locked && <span>🔒</span>}
                  <div>
                    <div>{board.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {board.board_id}
                    </div>
                  </div>
                </div>
              </TableCell>

              {/* Sprint */}
              <TableCell>
                {board.sprint ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      Sprint {board.sprint.number}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {board.sprint.name}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>

              {/* Progress */}
              <TableCell>
                {board.sprint ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {board.sprint.completed_points}/{board.sprint.total_points} pts
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(board.sprint.completed_points / board.sprint.total_points) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>

              {/* Sessions */}
              <TableCell>
                <SessionCount boardId={board.board_id} />
              </TableCell>

              {/* Lock Status */}
              <TableCell>
                <BoardLockStatus
                  locked={board.locked}
                  lock_owner={board.lock_owner}
                  locked_at={board.locked_at}
                  last_heartbeat={board.last_heartbeat}
                  is_stale={board.is_stale}
                />
              </TableCell>

              {/* Actions */}
              <TableCell>
                <BoardLockActions
                  board_id={board.board_id}
                  locked={board.locked}
                  is_stale={board.is_stale}
                  lock_owner={board.lock_owner}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Crash Recovery Dialog */}
      {staleLock && checkpoint && (
        <CrashRecoveryDialog
          open={showRecoveryDialog}
          onOpenChange={setShowRecoveryDialog}
          staleLock={staleLock}
          checkpoint={checkpoint}
          onTakeover={handleTakeover}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
