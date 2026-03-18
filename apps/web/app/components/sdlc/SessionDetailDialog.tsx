/**
 * SessionDetailDialog Component
 * Shows detailed information about a Claude Code session
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SessionStatusBadge, SessionStatus } from "./SessionStatusBadge";
import { formatDistanceToNow } from "date-fns";

interface SessionCheckpoint {
  timestamp: string;
  last_completed_story?: string;
  stories_completed?: string[];
  stories_in_progress?: string[];
  board_state_snapshot?: {
    columns?: Array<{
      id: string;
      name: string;
      story_ids: string[];
    }>;
    metrics?: {
      total_stories: number;
      completed: number;
      in_progress: number;
      blocked: number;
      velocity: number;
    };
  };
}

interface Session {
  session_id: string;
  status: SessionStatus;
  boards_locked: string[];
  last_heartbeat: string;
  current_story: string | null;
  checkpoint: SessionCheckpoint | null;
}

interface SessionDetailDialogProps {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetailDialog({ session, open, onOpenChange }: SessionDetailDialogProps) {
  if (!session) return null;

  const checkpoint = session.checkpoint;
  const metrics = checkpoint?.board_state_snapshot?.metrics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Session: {session.session_id}
          </DialogTitle>
          <DialogDescription>
            Last active {formatDistanceToNow(new Date(session.last_heartbeat), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Health:</span>
                <SessionStatusBadge status={session.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Last Heartbeat:</span>
                <span className="text-sm font-mono">
                  {new Date(session.last_heartbeat).toLocaleString()}
                </span>
              </div>
              {session.boards_locked.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Boards Locked:</span>
                  <div className="flex gap-2">
                    {session.boards_locked.map((board) => (
                      <Badge key={board} variant="outline">{board}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Work Section */}
          {session.current_story && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Work</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Working On:</span>
                  <Badge variant="default">{session.current_story}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checkpoint Data Section */}
          {checkpoint && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Checkpoint Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stories Progress */}
                {checkpoint.stories_in_progress && checkpoint.stories_in_progress.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">In Progress ({checkpoint.stories_in_progress.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {checkpoint.stories_in_progress.map((storyId) => (
                        <Badge key={storyId} variant="secondary">{storyId}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {checkpoint.stories_completed && checkpoint.stories_completed.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Completed ({checkpoint.stories_completed.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {checkpoint.stories_completed.slice(0, 10).map((storyId) => (
                        <Badge key={storyId} variant="outline">{storyId}</Badge>
                      ))}
                      {checkpoint.stories_completed.length > 10 && (
                        <Badge variant="outline">+{checkpoint.stories_completed.length - 10} more</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Board Metrics */}
                {metrics && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Board Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-2xl font-bold">{metrics.total_stories}</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Completed</div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {metrics.completed}
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">In Progress</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {metrics.in_progress}
                        </div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Blocked</div>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {metrics.blocked}
                        </div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Velocity</div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {metrics.velocity}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Board Columns */}
                {checkpoint.board_state_snapshot?.columns && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Board State</h4>
                    <div className="space-y-2">
                      {checkpoint.board_state_snapshot.columns.map((column) => (
                        <div key={column.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{column.name}</span>
                            <Badge variant="outline">{column.story_ids.length}</Badge>
                          </div>
                          {column.story_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {column.story_ids.map((storyId) => (
                                <Badge key={storyId} variant="secondary" className="text-xs">
                                  {storyId}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
