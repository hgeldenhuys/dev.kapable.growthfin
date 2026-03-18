/**
 * Research Session Detail Page
 * Detailed view of a research session with queries and findings preview
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Eye, Square, Sparkles, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { ResearchStatusBadge } from '~/components/research/ResearchStatusBadge';
import { EnrichmentPreviewDialog } from '~/components/research/EnrichmentPreviewDialog';
import { useResearchSession, useResearchFindings, useStopResearchSession } from '~/hooks/useResearch';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { toast } from 'sonner';
import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ResearchSessionDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const sessionId = params.sessionId!;
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Fetch session with 3s polling
  const { data: session, isLoading, error } = useResearchSession(sessionId, workspaceId, {
    refetchInterval: 3000,
  });

  // Fetch findings for preview
  const { data: findings } = useResearchFindings(sessionId, workspaceId, {
    refetchInterval: 5000,
  });

  const stopSession = useStopResearchSession();

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/research`);
  };

  const handleStop = async () => {
    try {
      await stopSession.mutateAsync({ sessionId, workspaceId });
      toast.success('Research stopped', { description: 'The research session has been stopped.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-destructive">Error loading session: {String(error)}</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Research
        </Button>
      </div>
    );
  }

  // Calculate duration
  let duration = '';
  if (session.startedAt) {
    const start = new Date(session.startedAt);
    const end = session.completedAt ? new Date(session.completedAt) : new Date();
    const interval = intervalToDuration({ start, end });
    duration = formatDuration(interval, { format: ['hours', 'minutes', 'seconds'] });
  }

  // Preview findings (top 5)
  const previewFindings = findings?.slice(0, 5) || [];
  const hasMoreFindings = (findings?.length || 0) > 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ResearchStatusBadge status={session.status} />
              <Badge variant="outline" className="capitalize">
                {session.scope === 'basic' ? 'Basic' : 'Deep'}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold">{session.objective}</h1>
            <p className="text-muted-foreground">Research Session Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {session.status === 'running' && (
            <Button variant="outline" onClick={handleStop} disabled={stopSession.isPending}>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          )}
          {session.status === 'completed' && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(true)}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Apply Enrichments
              </Button>
              <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/research/${sessionId}/findings`)}>
                <Eye className="mr-2 h-4 w-4" />
                View All Findings
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Session Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Entity</p>
              <p className="text-lg font-semibold capitalize">{session.entityType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scope</p>
              <p className="text-lg font-semibold capitalize">{session.scope}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Queries Used</p>
              <p className="text-lg font-semibold">
                {session.queriesUsed} / {session.maxQueries}
              </p>
            </div>
            {duration && (
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{duration || 'N/A'}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Queries & Findings */}
      <Tabs defaultValue="findings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="findings">
            <Sparkles className="mr-2 h-4 w-4" />
            Findings Preview
          </TabsTrigger>
          <TabsTrigger value="queries">
            <Search className="mr-2 h-4 w-4" />
            Queries
          </TabsTrigger>
        </TabsList>

        {/* Findings Tab */}
        <TabsContent value="findings">
          <Card>
            <CardHeader>
              <CardTitle>Top Findings</CardTitle>
            </CardHeader>
            <CardContent>
              {!previewFindings || previewFindings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No findings yet</p>
                  {session.status === 'running' && (
                    <p className="text-sm mt-1">Research is still running...</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {previewFindings.map((finding) => (
                    <div key={finding.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline">{finding.category}</Badge>
                        <Badge
                          className={
                            finding.confidence === 'high'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : finding.confidence === 'medium'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          }
                        >
                          {finding.confidence} confidence
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{finding.finding}</p>
                      <p className="text-xs text-muted-foreground">
                        {finding.sources.length} source{finding.sources.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                  {hasMoreFindings && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate(`/dashboard/${workspaceId}/crm/research/${sessionId}/findings`)}
                    >
                      View All {findings?.length} Findings
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queries Tab */}
        <TabsContent value="queries">
          <Card>
            <CardHeader>
              <CardTitle>Executed Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Query history not yet implemented</p>
                <p className="text-sm mt-1">
                  This will show all web searches executed during research
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enrichment Preview Dialog */}
      <EnrichmentPreviewDialog
        sessionId={sessionId}
        workspaceId={workspaceId}
        userId={userId}
        open={showPreviewDialog}
        onClose={() => setShowPreviewDialog(false)}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
