/**
 * SessionsTable Component
 * Displays list of active Claude Code sessions with health indicators
 */

import { useState } from "react";
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
import { Badge } from "../ui/badge";
import { SessionStatusBadge, SessionStatus } from "./SessionStatusBadge";
import { SessionDetailDialog } from "./SessionDetailDialog";
import { formatDistanceToNow } from "date-fns";
import { Clock, Boxes, FileText } from "lucide-react";

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

export interface Session {
  session_id: string;
  status: SessionStatus;
  boards_locked: string[];
  last_heartbeat: string;
  current_story: string | null;
  checkpoint: SessionCheckpoint | null;
}

interface SessionsTableProps {
  sessions: Session[];
}

/**
 * CurrentBoard Component
 * Fetches and displays current board for a session
 */
function CurrentBoard({ sessionId }: { sessionId: string }) {
  const { data } = useQuery({
    queryKey: ['session-boards', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/sdlc/sessions/${sessionId}/boards`);
      if (!response.ok) {
        throw new Error('Failed to fetch session boards');
      }
      return response.json();
    },
    refetchInterval: 10000,
  });

  if (!data?.current) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <Link to={`/claude/sdlc/boards/${data.current.id}`}>
      <Badge variant="outline" className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 w-fit">
        <Boxes className="h-3 w-3" />
        {data.current.name || data.current.id}
      </Badge>
    </Link>
  );
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRowClick = (session: Session) => {
    setSelectedSession(session);
    setDialogOpen(true);
  };

  if (sessions.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <div className="text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No Active Sessions</p>
          <p className="text-sm">
            Start a Claude Code session to see it appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current Board</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Working On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow
                key={session.session_id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(session)}
              >
                {/* Session ID */}
                <TableCell className="font-mono text-sm">
                  {session.session_id}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <SessionStatusBadge status={session.status} />
                </TableCell>

                {/* Current Board */}
                <TableCell>
                  <CurrentBoard sessionId={session.session_id} />
                </TableCell>

                {/* Last Active */}
                <TableCell className="text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDistanceToNow(new Date(session.last_heartbeat), { addSuffix: true })}
                  </div>
                </TableCell>

                {/* Working On */}
                <TableCell>
                  {session.current_story ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="default">{session.current_story}</Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <SessionDetailDialog
        session={selectedSession}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
