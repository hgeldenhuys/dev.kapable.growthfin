/**
 * Research Findings Review Page
 * Review and approve/reject research findings
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Loader2, Check, X, ExternalLink, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ResearchStatusBadge } from '~/components/research/ResearchStatusBadge';
import { EnrichmentPreviewDialog } from '~/components/research/EnrichmentPreviewDialog';
import {
  useResearchSession,
  useResearchFindings,
  useApproveFinding,
  useRejectFinding,
  useApplySingleFinding,
  type ResearchFinding,
} from '~/hooks/useResearch';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type SortBy = 'confidence' | 'category' | 'status';

export default function ResearchFindingsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const sessionId = params.sessionId!;

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('confidence');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<ResearchFinding | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Fetch session and findings with 5s polling
  const { data: session } = useResearchSession(sessionId, workspaceId, {
    refetchInterval: 5000,
  });
  const { data: findings, isLoading, error } = useResearchFindings(sessionId, workspaceId, {
    refetchInterval: 5000,
  });

  const approveFinding = useApproveFinding();
  const rejectFinding = useRejectFinding();
  const applySingle = useApplySingleFinding();

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/research/${sessionId}`);
  };

  const handleApprove = async (finding: ResearchFinding) => {
    try {
      await approveFinding.mutateAsync({
        findingId: finding.id,
        workspaceId,
        reviewedBy: userId,
      });
      toast.success('Finding approved', { description: 'The finding has been approved.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleRejectClick = (finding: ResearchFinding) => {
    setSelectedFinding(finding);
    setRejectNotes('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedFinding) return;

    try {
      await rejectFinding.mutateAsync({
        findingId: selectedFinding.id,
        workspaceId,
        reviewedBy: userId,
        reviewNotes: rejectNotes.trim() || undefined,
      });
      toast.success('Finding rejected', { description: 'The finding has been rejected.' });
      setRejectDialogOpen(false);
      setSelectedFinding(null);
      setRejectNotes('');
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const toggleSources = (findingId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(findingId)) {
      newExpanded.delete(findingId);
    } else {
      newExpanded.add(findingId);
    }
    setExpandedSources(newExpanded);
  };

  const handleApplySingle = async (findingId: string) => {
    try {
      await applySingle.mutateAsync({
        findingId,
        workspaceId,
        userId,
      });
      toast.success('Finding applied', { description: 'The finding has been applied to the contact record.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Filter findings
  let filteredFindings = findings || [];
  if (filterStatus !== 'all') {
    filteredFindings = filteredFindings.filter((f) => f.status === filterStatus);
  }

  // Sort findings
  filteredFindings = filteredFindings.slice().sort((a, b) => {
    if (sortBy === 'confidence') {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    }
    if (sortBy === 'category') {
      return a.category.localeCompare(b.category);
    }
    if (sortBy === 'status') {
      return a.status.localeCompare(b.status);
    }
    return 0;
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
        <p className="text-destructive">Error loading findings: {String(error)}</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Session
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Research Findings</h1>
            <p className="text-muted-foreground">{session?.objective}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session && <ResearchStatusBadge status={session.status} />}
          {session?.status === 'completed' && findings && findings.length > 0 && (
            <Button
              onClick={() => setShowPreviewDialog(true)}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Apply Enrichments
            </Button>
          )}
        </div>
      </div>

      {/* Session Summary */}
      {session && (
        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Entity</p>
                <Link
                  to={`/dashboard/crm/${session.entityType}s/${session.entityId}`}
                  className="text-blue-500 hover:underline capitalize"
                >
                  View {session.entityType}
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scope</p>
                <p className="font-semibold capitalize">{session.scope}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Findings</p>
                <p className="font-semibold">{findings?.length || 0} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-sm">
            Sort by:
          </Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger id="sort" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Findings Grid */}
      {!filteredFindings || filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {filterStatus === 'all'
                ? 'No findings yet. Research may still be running.'
                : `No ${filterStatus} findings.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedSources.has(finding.id);
            return (
              <Card key={finding.id} className="flex flex-col">
                <CardHeader>
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
                      {finding.confidence}
                    </Badge>
                  </div>
                  {finding.status !== 'pending' && (
                    <Badge
                      className={
                        finding.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                      }
                    >
                      {finding.status}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm mb-4 flex-1">{finding.finding}</p>

                  {/* Sources */}
                  <div className="mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSources(finding.id)}
                      className="p-0 h-auto font-normal text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3 mr-1" />
                      ) : (
                        <ChevronDown className="h-3 w-3 mr-1" />
                      )}
                      View {finding.sources.length} source{finding.sources.length !== 1 ? 's' : ''}
                    </Button>
                    {isExpanded && (
                      <div className="mt-2 space-y-1">
                        {finding.sources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {finding.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(finding)}
                        disabled={approveFinding.isPending}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleRejectClick(finding)}
                        disabled={rejectFinding.isPending}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Apply button for approved findings */}
                  {finding.status === 'approved' && !finding.appliedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleApplySingle(finding.id)}
                      disabled={applySingle.isPending}
                    >
                      {applySingle.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1 h-4 w-4" />
                          Apply
                        </>
                      )}
                    </Button>
                  )}

                  {/* Applied badge */}
                  {finding.appliedAt && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 w-full justify-center">
                      Applied {formatDistanceToNow(new Date(finding.appliedAt), { addSuffix: true })}
                    </Badge>
                  )}

                  {finding.reviewNotes && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-semibold">Notes:</span> {finding.reviewNotes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Finding</DialogTitle>
            <DialogDescription>
              Optionally provide notes about why this finding is being rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-notes">Rejection Notes (Optional)</Label>
              <Textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Why is this finding incorrect or not useful?"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectFinding.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectFinding.isPending}
            >
              {rejectFinding.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Finding'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
