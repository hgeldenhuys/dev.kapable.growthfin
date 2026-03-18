/**
 * Session Audit Log Component
 * Table with pagination showing Claude Code sessions
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { useSessionAuditLog, type SessionAudit } from '~/hooks/useAIAnalytics';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface SessionAuditLogProps {
  workspaceId: string;
}

function SessionDetailsDialog({ session }: { session: SessionAudit }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Session Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Session ID</h4>
            <code className="text-sm bg-muted p-2 rounded block">{session.sessionId}</code>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Conversation ID</h4>
            <code className="text-sm bg-muted p-2 rounded block">{session.conversationId}</code>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Prompt</h4>
            <p className="text-sm bg-muted p-3 rounded">{session.prompt}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Status</h4>
            <Badge
              className={
                session.status === 'completed'
                  ? 'bg-green-500'
                  : session.status === 'error'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }
            >
              {session.status}
            </Badge>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Files Modified ({session.filesModified.length})</h4>
            <ul className="text-sm space-y-1">
              {session.filesModified.length === 0 ? (
                <li className="text-muted-foreground">No files modified</li>
              ) : (
                session.filesModified.map((file, i) => (
                  <li key={i} className="font-mono text-xs bg-muted p-1 rounded">
                    {file}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Created At</h4>
            <p className="text-sm">{format(new Date(session.createdAt), 'PPpp')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SessionAuditLog({ workspaceId }: SessionAuditLogProps) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'error'>('all');
  const pageSize = 50;

  const { data, isLoading, error } = useSessionAuditLog(workspaceId, {
    limit: pageSize,
    offset: page * pageSize,
    status: statusFilter,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Session Audit Log</CardTitle>
          <div className="flex items-center gap-4">
            <Select
              value={statusFilter}
              onValueChange={(v: typeof statusFilter) => {
                setStatusFilter(v);
                setPage(0); // Reset to first page on filter change
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-center py-8 text-red-600">
            Error loading sessions: {String(error)}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading sessions...
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Files Modified</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No sessions found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-xs">
                        {session.sessionId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={session.prompt}>
                        {session.prompt}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            session.status === 'completed'
                              ? 'bg-green-500'
                              : session.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {session.filesModified.length}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(session.createdAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <SessionDetailsDialog session={session} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1} to{' '}
                {Math.min((page + 1) * pageSize, data.total)} of {data.total} sessions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!hasPrevPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {page + 1} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!hasNextPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
