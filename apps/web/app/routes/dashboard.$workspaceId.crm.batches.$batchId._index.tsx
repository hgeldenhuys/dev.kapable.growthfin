/**
 * Batch Detail Page
 * View and manage individual batch with configuration and timeline
 *
 * Architecture (US-014):
 * - Loader: Fetches batch from database via Drizzle ORM
 * - SSE: Real-time updates via useBatchesSSE hook
 * - Mutations: useDeleteTask, useChangeTaskStatus, etc. trigger revalidation
 */

import { useState } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ArrowLeft,
  Loader2,
  Edit,
  Trash2,
  BanIcon,
  Calendar,
  Clock,
  CheckCircle,
  ExternalLink,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
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
import { useDeleteTask, useChangeTaskStatus, useRetryTask, useExecuteTask } from '~/hooks/useTasks';
import { useTasksSSE } from '~/hooks/useTasksSSE';
import { toast } from 'sonner';
import type { Task } from '~/hooks/useTasks';
import { TaskStatusBadge } from '~/components/crm/tasks/TaskStatusBadge';
import { TaskTypeBadge } from '~/components/crm/tasks/TaskTypeBadge';
import { TaskExecutionPanel } from '~/components/crm/tasks/TaskExecutionPanel';
import { TaskExecutionReport } from '~/components/crm/tasks/TaskExecutionReport';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for batch detail page
 * Fetches single batch from database using Drizzle ORM
 */
export async function loader({ params }: LoaderFunctionArgs) {
  // Import server-only modules inside the loader to prevent client bundling
  const { db, crmBatches, eq, and } = await import('~/lib/db.server');

  const { workspaceId, batchId } = params;

  if (!workspaceId || !batchId) {
    return { batch: null };
  }

  // Fetch batch by ID
  const [batch] = await db
    .select()
    .from(crmBatches)
    .where(and(eq(crmBatches.workspaceId, workspaceId), eq(crmBatches.id, batchId)))
    .limit(1);

  return { batch: batch || null };
}

export default function BatchDetailPage() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const workspaceId = useWorkspaceId();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);

  // Batch data from loader (US-014: React Router loader pattern)
  const loaderData = useLoaderData<typeof loader>();
  const batch = loaderData?.batch as Task | null;

  // Subscribe to SSE for real-time updates (US-014: AC-002)
  // SSE replaces the old polling refetchInterval approach
  useTasksSSE(workspaceId);

  const deleteTask = useDeleteTask();
  const changeStatus = useChangeTaskStatus();
  const retryTask = useRetryTask();
  const executeTask = useExecuteTask();

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/batches`);
  };

  const handleViewList = () => {
    if (batch?.listId) {
      navigate(`/dashboard/${workspaceId}/crm/lists/${batch.listId}`);
    }
  };

  const handleExecute = async () => {
    if (!batchId) return;

    try {
      await executeTask.mutateAsync({ taskId: batchId, workspaceId });

      toast.success('Batch Operation Started', { description: 'Batch operation is now running. Progress updates will appear below.' });
    } catch (error) {
      toast.error('Execution Failed', { description: error instanceof Error ? error.message : 'Failed to start batch operation' });
    }
  };

  const handleDelete = async () => {
    if (!batchId) return;

    try {
      await deleteTask.mutateAsync({ taskId: batchId, workspaceId });

      toast.success('Batch Operation Deleted', { description: 'Batch operation deleted successfully' });

      handleBack();
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete batch operation' });
    }
  };

  const handleCancel = async () => {
    if (!batchId) return;

    try {
      await changeStatus.mutateAsync({
        taskId: batchId,
        workspaceId,
        status: { status: 'cancelled' },
      });

      toast.success('Batch Operation Cancelled', { description: 'Batch operation cancelled' });

      setShowCancelDialog(false);
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to cancel batch operation' });
    }
  };

  const handleRetry = async () => {
    if (!batchId) return;

    try {
      const result = await retryTask.mutateAsync({ taskId: batchId, workspaceId });

      // Build description based on what failed
      const failedContactCount = result.retryTask?.failedContactCount || 0;
      const failedLeadCount = result.retryTask?.failedLeadCount || 0;

      let description = 'Created retry batch with ';
      const parts: string[] = [];
      if (failedContactCount > 0) parts.push(`${failedContactCount} failed contact${failedContactCount === 1 ? '' : 's'}`);
      if (failedLeadCount > 0) parts.push(`${failedLeadCount} failed lead${failedLeadCount === 1 ? '' : 's'}`);
      description += parts.join(' and ');

      toast.success('Retry Operation Created');

      setShowRetryDialog(false);

      // Navigate to the new retry batch
      if (result.retryTask?.id) {
        navigate(`/dashboard/${workspaceId}/crm/batches/${result.retryTask.id}`);
      }
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to create retry operation' });
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  // Note: No isLoading check needed - loader handles data fetching before render
  // React Router Suspense boundary handles loading states

  if (!batch) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Batch Operations
        </Button>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Batch operation not found</h3>
          <p className="text-muted-foreground">
            The batch operation you are looking for does not exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  const canDelete = batch.status === 'planned';
  const canCancel = batch.status === 'planned' || batch.status === 'scheduled';
  const canExecute = batch.status === 'planned' || batch.status === 'scheduled';
  const canRetry = batch.status === 'failed' || batch.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Batch Operations
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{batch.name}</h1>
                <TaskTypeBadge type={batch.type} />
                <TaskStatusBadge status={batch.status} />
              </div>
              {batch.description && <p className="text-muted-foreground">{batch.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canExecute && (
            <Button onClick={handleExecute} disabled={executeTask.isPending}>
              {executeTask.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Batch
            </Button>
          )}
          {canRetry && (
            <Button variant="outline" onClick={() => setShowRetryDialog(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Failed
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
              <BanIcon className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Batch Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Operation Details</CardTitle>
          <CardDescription>Basic information about this batch operation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Batch Type</label>
              <div className="mt-1">
                <TaskTypeBadge type={batch.type} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <TaskStatusBadge status={batch.status} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Scheduled At</label>
              <p className="mt-1">{formatDateTime(batch.scheduledAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created At</label>
              <p className="mt-1">{formatDateTime(batch.createdAt)}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Associated List</label>
            <div className="mt-1">
              <Button variant="link" className="p-0 h-auto" onClick={handleViewList}>
                View List
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Batch-specific settings and parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {!batch.configuration || Object.entries(batch.configuration).length === 0 ? (
              <p className="text-sm text-muted-foreground">No configuration settings</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(batch.configuration).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Execution Panel - Shows inline when batch is running/completed/failed */}
      {(batch.status === 'running' || batch.status === 'completed' || batch.status === 'failed') && (
        <TaskExecutionPanel
          taskId={batchId || ''}
          workspaceId={workspaceId}
          taskStatus={batch.status}
          taskConfiguration={batch.configuration}
          task={batch}
        />
      )}

      {/* Execution Report - Shows after batch completion/failure with detailed results */}
      {(batch.status === 'completed' || batch.status === 'failed') &&
        batch.configuration?.enrichmentJobId && (
          <Card>
            <CardHeader>
              <CardTitle>Execution Report</CardTitle>
              <CardDescription>
                Detailed execution results including entity-level outcomes and tool usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskExecutionReport
                jobId={batch.configuration.enrichmentJobId}
                workspaceId={workspaceId}
              />
            </CardContent>
          </Card>
        )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Batch execution history and lifecycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-blue-100 p-2">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Created</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(batch.createdAt)}</p>
              </div>
            </div>

            {batch.scheduledAt && (
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-purple-100 p-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(batch.scheduledAt)}
                  </p>
                </div>
              </div>
            )}

            {batch.startedAt && (
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-yellow-100 p-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Started</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(batch.startedAt)}</p>
                </div>
              </div>
            )}

            {batch.completedAt && (
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-green-100 p-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Completed</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(batch.completedAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch Operation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{batch.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTask.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Operation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Batch Operation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel "{batch.name}". Cancelled operations cannot be restarted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={changeStatus.isPending}>
              {changeStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Operation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retry Confirmation */}
      <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Failed Entities?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new batch operation with only the entities (contacts and/or leads) that failed in "{batch.name}".
              The new operation will use the same configuration as the original.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetry} disabled={retryTask.isPending}>
              {retryTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Retry Operation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
