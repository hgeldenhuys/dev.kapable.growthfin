/**
 * Batch Execution Page
 * Monitor and control batch execution with live progress updates via SSE
 *
 * Architecture (US-014):
 * - Loader: Fetches batch from database via Drizzle ORM
 * - SSE: Real-time updates via useBatchesSSE hook
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ArrowLeft,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useExecuteTask, useRetryTask } from '~/hooks/useTasks';
import type { Task } from '~/hooks/useTasks';
import { useTasksSSE } from '~/hooks/useTasksSSE';
import { toast } from 'sonner';
import { TaskStatusBadge } from '~/components/crm/tasks/TaskStatusBadge';
import { TaskTypeBadge } from '~/components/crm/tasks/TaskTypeBadge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

interface ProgressUpdate {
  type: 'contact_processed' | 'task_completed' | 'task_failed';
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  status?: 'success' | 'error' | 'skipped';
  cost?: number;
  error?: string;
  timestamp?: string;
}

interface ExecutionSummary {
  processed: number;
  failed: number;
  skipped: number;
  totalCost: number;
}

/**
 * Loader for batch execution page
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

export default function BatchExecutionPage() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const workspaceId = useWorkspaceId();
  // Batch data from loader (US-014: React Router loader pattern)
  const loaderData = useLoaderData<typeof loader>();
  const batch = loaderData?.batch as Task | null;

  // Subscribe to SSE for real-time updates (US-014: AC-002)
  useTasksSSE(workspaceId);

  const executeMutation = useExecuteTask();
  const retryMutation = useRetryTask();

  const [progressEvents, setProgressEvents] = useState<ProgressUpdate[]>([]);
  const [summary, setSummary] = useState<ExecutionSummary>({
    processed: 0,
    failed: 0,
    skipped: 0,
    totalCost: 0,
  });

  // SSE Progress Tracking
  useEffect(() => {
    if (!batchId || !workspaceId) return;
    if (batch?.status !== 'running') return;

    const eventSource = new EventSource(
      `/api/v1/crm/batches/${batchId}/progress?workspaceId=${workspaceId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressUpdate = JSON.parse(event.data);

        if (data.type === 'contact_processed') {
          setProgressEvents((prev) => [...prev, data]);

          setSummary((prev) => ({
            processed: prev.processed + (data.status === 'success' ? 1 : 0),
            failed: prev.failed + (data.status === 'error' ? 1 : 0),
            skipped: prev.skipped + (data.status === 'skipped' ? 1 : 0),
            totalCost: prev.totalCost + (data.cost || 0),
          }));
        }

        if (data.type === 'task_completed' || data.type === 'task_failed') {
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [batch?.status, batchId, workspaceId]);

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/batches/${batchId}`);
  };

  const handleExecute = async () => {
    if (!batchId) return;

    try {
      await executeMutation.mutateAsync({ taskId: batchId, workspaceId });

      toast.success('Batch Operation Started', { description: 'Operation is now running. Progress updates will appear below.' });
    } catch (error) {
      toast.error('Execution Failed', { description: error instanceof Error ? error.message : 'Failed to start batch operation' });
    }
  };

  const handleRetry = async () => {
    if (!batchId) return;

    try {
      const newBatch = await retryMutation.mutateAsync({ taskId: batchId, workspaceId });

      toast.success('Retry Operation Created', { description: `Retry operation "${newBatch.name}" created successfully.` });

      // Navigate to the new retry batch
      navigate(`/dashboard/${workspaceId}/crm/batches/${newBatch.id}/run`);
    } catch (error) {
      toast.error('Retry Failed', { description: error instanceof Error ? error.message : 'Failed to create retry operation' });
    }
  };

  // Note: No isLoading check needed - loader handles data fetching before render
  // React Router Suspense boundary handles loading states

  if (!batch) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Batch Operation
        </Button>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Batch operation not found</h3>
          <p className="text-muted-foreground">The batch operation you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  const budgetLimit = batch.configuration?.budgetLimit || 0;
  const budgetUsedPercent = budgetLimit > 0 ? (summary.totalCost / budgetLimit) * 100 : 0;
  const totalContacts = summary.processed + summary.failed + summary.skipped;
  const failedContacts = progressEvents.filter((e) => e.status === 'error');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Batch Operation
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{batch.name}</h1>
            <TaskTypeBadge type={batch.type} />
            <TaskStatusBadge status={batch.status} />
          </div>
          {batch.description && <p className="text-muted-foreground">{batch.description}</p>}
        </div>
        {batch.status === 'planned' && (
          <Button onClick={handleExecute} disabled={executeMutation.isPending}>
            {executeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Execution
          </Button>
        )}
      </div>

      {/* Budget Indicator */}
      {budgetLimit > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={Math.min(budgetUsedPercent, 100)} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium">
                ${summary.totalCost.toFixed(4)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            {budgetUsedPercent > 90 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>Budget nearly exhausted</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution Summary */}
      {batch.status === 'running' || batch.status === 'completed' || batch.status === 'failed' ? (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContacts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.processed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Live Progress Feed */}
      {batch.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Contacts
            </CardTitle>
            <CardDescription>
              Live updates as contacts are being processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {progressEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Waiting for progress updates...
                </p>
              ) : (
                progressEvents.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.contactName}</p>
                      {item.contactEmail && (
                        <p className="text-xs text-muted-foreground">{item.contactEmail}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </Badge>
                      )}
                      {item.status === 'error' && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                      {item.status === 'skipped' && (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Skipped
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        ${(item.cost || 0).toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {batch.status === 'planned' && !executeMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Ready to Execute</p>
                <p className="text-sm text-muted-foreground">
                  Click "Start Execution" to begin processing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {batch.status === 'scheduled' && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <AlertCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Scheduled for Later</p>
                <p className="text-sm text-muted-foreground">
                  This operation is scheduled to run at{' '}
                  {batch.scheduledAt ? new Date(batch.scheduledAt).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Summary */}
      {batch.status === 'completed' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Execution Complete
            </CardTitle>
            <CardDescription>Operation finished successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold text-green-700">{summary.processed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skipped</p>
                <p className="text-2xl font-bold">{summary.skipped}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Contacts Table */}
      {(batch.status === 'completed' || batch.status === 'failed') &&
        failedContacts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Failed Contacts ({failedContacts.length})</CardTitle>
                <CardDescription>
                  Contacts that could not be processed successfully
                </CardDescription>
              </div>
              <Button onClick={handleRetry} disabled={retryMutation.isPending}>
                {retryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry Failed
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedContacts.map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {contact.contactName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.contactEmail || 'N/A'}
                      </TableCell>
                      <TableCell className="text-destructive text-sm">
                        {contact.error || 'Unknown error'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
