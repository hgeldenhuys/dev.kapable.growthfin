/**
 * Research Dashboard Route
 * List of all AI research sessions with live updates
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, Sparkles, Eye, Square, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { ResearchStatusBadge } from '~/components/research/ResearchStatusBadge';
import { CreateResearchDialog } from '~/components/research/CreateResearchDialog';
import { useResearchSessions, useStopResearchSession } from '~/hooks/useResearch';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ResearchDashboardPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch sessions with 3s polling
  const { data: sessions, isLoading, error } = useResearchSessions(workspaceId, {
    refetchInterval: 3000,
  });

  const stopSession = useStopResearchSession();

  const handleStopSession = async (sessionId: string) => {
    try {
      await stopSession.mutateAsync({ sessionId, workspaceId });
      toast.success('Research stopped', { description: 'The research session has been stopped.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Sort: running first, then by createdAt desc
  const sortedSessions = sessions?.slice().sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (a.status !== 'running' && b.status === 'running') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">Error loading research sessions: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-blue-500" />
            AI Research Sessions
          </h1>
          <p className="text-muted-foreground">
            Enrich contact data with AI-powered web research
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4" />
          New Research
        </Button>
      </div>

      {/* Create Research Dialog */}
      <CreateResearchDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        entityType="contact"
        workspaceId={workspaceId}
        userId={userId}
      />

      {/* Sessions List */}
      {!sortedSessions || sortedSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Sparkles className="h-16 w-16 text-muted-foreground opacity-50" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">No research sessions yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Start enriching your contact data with AI-powered research using the "New Research" button above
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedSessions.map((session) => {
            const timeInfo = session.startedAt
              ? `Started ${formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}`
              : `Created ${formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}`;

            return (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ResearchStatusBadge status={session.status} />
                        <Badge variant="outline" className="capitalize">
                          {session.scope === 'basic' ? 'Basic' : 'Deep'}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg font-bold mb-2">
                        {session.objective}
                      </CardTitle>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="capitalize">{session.entityType}:</span>
                          <Link
                            to={`/dashboard/crm/${session.entityType}s/${session.entityId}`}
                            className="text-blue-500 hover:underline"
                          >
                            View {session.entityType}
                          </Link>
                        </div>
                        <div>
                          Progress: {session.queriesUsed}/{session.maxQueries} queries used
                        </div>
                        <div>{timeInfo}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {session.status === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStopSession(session.id)}
                          disabled={stopSession.isPending}
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                      )}
                      {session.status === 'completed' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/dashboard/${workspaceId}/crm/research/${session.id}/findings`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Findings
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/${workspaceId}/crm/research/${session.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
