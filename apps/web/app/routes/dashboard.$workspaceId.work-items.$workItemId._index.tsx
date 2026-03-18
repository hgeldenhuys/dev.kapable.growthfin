/**
 * Work Item Detail Page (UI-001 Enhanced)
 * View work item details with timeline, provenance, claim/unclaim and complete actions
 */

import { useState } from 'react';
import { useParams, useNavigate, useLoaderData } from 'react-router';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.work-items.$workItemId._index';
import { db, workItems, eq, and } from '~/lib/db.server';
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { toast } from 'sonner';
import {
  WorkItemStatusBadge,
  WorkItemProvenanceBadge,
  WorkItemTimeline,
  WorkItemQuickActions,
} from '~/components/crm/work-items';

/**
 * Loader - Get authenticated user session and work item data
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId, workItemId } = params;

  // Fetch work item from database
  const [workItem] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId!), eq(workItems.workspaceId, workspaceId!)))
    .limit(1);

  if (!workItem) {
    throw new Response('Work item not found', { status: 404 });
  }

  return {
    userId: session.user.id,
    workItem,
  };
}

// Helper function to format entity type
function formatEntityType(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

// Helper function to format work item type
function formatWorkItemType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Get entity path for navigation
function getEntityPath(entityType: string, entityId: string, workspaceId: string): string {
  const paths: Record<string, string> = {
    lead: `/dashboard/${workspaceId}/crm/leads/${entityId}`,
    contact: `/dashboard/${workspaceId}/crm/contacts/${entityId}`,
    opportunity: `/dashboard/${workspaceId}/crm/opportunities/${entityId}`,
    account: `/dashboard/${workspaceId}/crm/accounts/${entityId}`,
  };
  return paths[entityType] || '#';
}

// Get source path for navigation
function getSourcePath(sourceType: string, sourceId: string, workspaceId: string): string | null {
  const paths: Record<string, string> = {
    batch: `/dashboard/${workspaceId}/crm/batches/${sourceId}`,
    campaign: `/dashboard/${workspaceId}/crm/campaigns/${sourceId}`,
  };
  return paths[sourceType] || null;
}

export default function WorkItemDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { userId, workItem } = useLoaderData<typeof loader>();

  const workItemId = params.workItemId!;
  const workspaceId = useWorkspaceId();

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/work-items`);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleComplete = async () => {
    try {
      const response = await fetch(
        `/api/v1/work-items/${workItemId}/complete?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completedBy: 'user',
            result: {
              notes: completionNotes,
              completedAt: new Date().toISOString(),
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to complete work item' });
      } else {
        toast.success('Work Item Completed', { description: 'The work item has been marked as completed.' });
        setShowCompleteDialog(false);
        window.location.reload();
      }
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleViewEntity = () => {
    const path = getEntityPath(workItem.entityType, workItem.entityId, workspaceId);
    navigate(path);
  };

  const handleViewSource = () => {
    if (workItem.sourceType && workItem.sourceId) {
      const path = getSourcePath(workItem.sourceType, workItem.sourceId, workspaceId);
      if (path) {
        navigate(path);
      }
    }
  };

  if (!workItem) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-destructive">Work item not found</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Work Items
        </Button>
      </div>
    );
  }

  const canComplete = (workItem.status === 'claimed' || workItem.status === 'in_progress') && workItem.claimedBy === userId;
  const hasSource = workItem.sourceType && workItem.sourceId;
  const sourcePath = hasSource ? getSourcePath(workItem.sourceType!, workItem.sourceId!, workspaceId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{workItem.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <WorkItemStatusBadge status={workItem.status} />
              {hasSource && (
                <WorkItemProvenanceBadge
                  sourceType={workItem.sourceType}
                  sourceId={workItem.sourceId}
                  workspaceId={workspaceId}
                  showProgress
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <WorkItemQuickActions
            workItem={workItem}
            workspaceId={workspaceId}
            userId={userId}
            onRefresh={handleRefresh}
          />
          <Button variant="outline" onClick={handleViewEntity}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View {formatEntityType(workItem.entityType)}
          </Button>
          {canComplete && (
            <Button onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work Item Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Work Item Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Type */}
                <div>
                  <Label className="text-muted-foreground">Work Item Type</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatWorkItemType(workItem.workItemType)}</span>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{workItem.priority}</span>
                  </div>
                </div>

                {/* Entity Reference */}
                <div>
                  <Label className="text-muted-foreground">Entity</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline">
                      {formatEntityType(workItem.entityType)}
                    </Badge>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={handleViewEntity}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </div>

                {/* Source/Provenance */}
                {hasSource && (
                  <div>
                    <Label className="text-muted-foreground">Source</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <WorkItemProvenanceBadge
                        sourceType={workItem.sourceType}
                        sourceId={workItem.sourceId}
                        workspaceId={workspaceId}
                        showProgress={false}
                        size="sm"
                      />
                      {sourcePath && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={handleViewSource}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Source
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Due Date */}
                {workItem.dueAt && (
                  <div>
                    <Label className="text-muted-foreground">Due Date</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(workItem.dueAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Expires At */}
                {workItem.expiresAt && (
                  <div>
                    <Label className="text-muted-foreground">Expires At</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(workItem.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Claimed By */}
                {workItem.claimedBy && (
                  <div>
                    <Label className="text-muted-foreground">Claimed By</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {workItem.claimedBy === userId ? 'You' : 'Another user'}
                      </span>
                      {workItem.claimedAt && (
                        <span className="text-xs text-muted-foreground">
                          ({new Date(workItem.claimedAt).toLocaleString()})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Completed At */}
                {workItem.completedAt && (
                  <div>
                    <Label className="text-muted-foreground">Completed</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">
                        {new Date(workItem.completedAt).toLocaleString()}
                      </span>
                      {workItem.completedBy && (
                        <Badge variant="secondary" className="text-xs">
                          by {workItem.completedBy}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {workItem.description && (
                <div className="border-t pt-6">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{workItem.description}</p>
                </div>
              )}

              {/* Result */}
              {workItem.result && (
                <div className="border-t pt-6">
                  <Label className="text-muted-foreground">Completion Result</Label>
                  <div className="mt-2 bg-muted/50 rounded p-4">
                    <pre className="text-sm whitespace-pre-wrap overflow-auto">
                      {JSON.stringify(workItem.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata Card */}
          {workItem.metadata && Object.keys(workItem.metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded p-4">
                  <pre className="text-sm whitespace-pre-wrap overflow-auto">
                    {JSON.stringify(workItem.metadata, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Timeline */}
        <div className="space-y-6">
          <WorkItemTimeline workItem={workItem} />

          {/* Source Progress Card (if from batch/campaign) */}
          {hasSource && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Source Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <WorkItemProvenanceBadge
                    sourceType={workItem.sourceType}
                    sourceId={workItem.sourceId}
                    workspaceId={workspaceId}
                    showProgress
                    size="lg"
                  />
                  {sourcePath && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleViewSource}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View {workItem.sourceType === 'batch' ? 'Batch' : 'Campaign'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Work Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this work item as completed. You can optionally add notes about the completion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="completion-notes">Completion Notes (Optional)</Label>
            <Textarea
              id="completion-notes"
              placeholder="Add any notes about how this work item was completed..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Complete Work Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
