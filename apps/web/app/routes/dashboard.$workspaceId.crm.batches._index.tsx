/**
 * Batches Index Page
 * View and manage all batches across workspace with filtering and bulk actions
 *
 * Architecture (US-014):
 * - Loader: Fetches initial batches from database via Drizzle ORM
 * - SSE: Real-time updates via useBatchesSSE hook
 * - Mutations: useBulkCancelBatches, useBulkDeleteBatches trigger revalidation
 */

import { useState } from 'react';
import { useNavigate, useLoaderData, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ListTodo,
  Trash2,
  BanIcon,
  Filter as FilterIcon,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
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
import { useBulkCancelTasks, useBulkDeleteTasks } from '~/hooks/useTasks';
import { useTasksSSE } from '~/hooks/useTasksSSE';
import { toast } from 'sonner';
import { TaskStatusBadge } from '~/components/crm/tasks/TaskStatusBadge';
import { TaskTypeBadge } from '~/components/crm/tasks/TaskTypeBadge';
import type { Task } from '~/hooks/useTasks';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for batches index page
 * Fetches batches directly from database using Drizzle ORM
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Import server-only modules inside the loader to prevent client bundling
  const { db, crmBatches, eq, desc, and } = await import('~/lib/db.server');

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  // Parse URL search params for filtering
  const url = new URL(request.url);
  const typeFilter = url.searchParams.get('type');
  const statusFilter = url.searchParams.get('status');

  // Build where conditions
  const whereConditions = [eq(crmBatches.workspaceId, workspaceId)];

  if (typeFilter && typeFilter !== 'all') {
    whereConditions.push(eq(crmBatches.type, typeFilter as any));
  }

  if (statusFilter && statusFilter !== 'all') {
    whereConditions.push(eq(crmBatches.status, statusFilter as any));
  }

  // Fetch batches
  const batches = await db
    .select()
    .from(crmBatches)
    .where(whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0])
    .orderBy(desc(crmBatches.createdAt));

  return { batches };
}

export default function BatchesIndexPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get filter values from URL search params (server-side filtering via loader)
  const typeFilter = searchParams.get('type') || 'all';
  const statusFilter = searchParams.get('status') || 'all';

  // Local state
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [showBulkCancelDialog, setShowBulkCancelDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Use loader data instead of useTasks hook (ARCH-001: React Router loader pattern)
  const loaderData = useLoaderData<typeof loader>();
  const batches = loaderData.batches as Task[];

  // Subscribe to SSE for real-time updates (US-014: AC-002)
  useTasksSSE(workspaceId);

  const bulkCancel = useBulkCancelTasks();
  const bulkDelete = useBulkDeleteTasks();

  // Helper to update search params (triggers loader revalidation)
  const updateSearchParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === 'all') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    }
    setSearchParams(newParams);
  };

  // Filter handlers - update URL params, which triggers loader
  const setTypeFilter = (type: string) => {
    updateSearchParams({ type: type === 'all' ? null : type });
  };

  const setStatusFilter = (status: string) => {
    updateSearchParams({ status: status === 'all' ? null : status });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBatches(new Set(batches.map((t) => t.id)));
    } else {
      setSelectedBatches(new Set());
    }
  };

  const handleSelectBatch = (batchId: string, checked: boolean) => {
    const newSelected = new Set(selectedBatches);
    if (checked) {
      newSelected.add(batchId);
    } else {
      newSelected.delete(batchId);
    }
    setSelectedBatches(newSelected);
  };

  const handleBulkCancel = async () => {
    try {
      await bulkCancel.mutateAsync({
        taskIds: Array.from(selectedBatches),
        workspaceId,
      });

      toast.success('Batch Operations Cancelled', { description: `${selectedBatches.size} batch operation(s) cancelled` });

      setSelectedBatches(new Set());
      setShowBulkCancelDialog(false);
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to cancel batch operations' });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync({
        taskIds: Array.from(selectedBatches),
        workspaceId,
      });

      toast.success('Batch Operations Deleted', { description: `${selectedBatches.size} batch operation(s) deleted` });

      setSelectedBatches(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete batch operations' });
    }
  };

  const handleRowClick = (batchId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/batches/${batchId}`);
  };

  const formatScheduledTime = (scheduledAt: string | null) => {
    if (!scheduledAt) return 'Not scheduled';
    return new Date(scheduledAt).toLocaleString();
  };

  // Note: No isLoading check needed - loader handles data fetching before render
  // React Router Suspense boundary handles loading states

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Batch Operations</h1>
          <p className="text-muted-foreground">
            Manage and track batch operations across all lists in your workspace
          </p>
        </div>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Batch Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="enrichment">Enrichment</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="segmentation">Segmentation</SelectItem>
                  <SelectItem value="scoring">Scoring</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedBatches.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedBatches.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkCancelDialog(true)}
                >
                  <BanIcon className="mr-2 h-4 w-4" />
                  Cancel Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Batch Operations ({batches.length})</CardTitle>
          <CardDescription>Click on a batch operation to view details and execution status</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No batch operations found</h3>
              <p className="text-muted-foreground mb-4">
                {typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create batch operations from list detail pages to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedBatches.size === batches.length && batches.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(batch.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedBatches.has(batch.id)}
                        onCheckedChange={(checked) =>
                          handleSelectBatch(batch.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{batch.name}</div>
                        {batch.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {batch.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TaskTypeBadge type={batch.type} />
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatScheduledTime(batch.scheduledAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bulk Cancel Confirmation */}
      <AlertDialog open={showBulkCancelDialog} onOpenChange={setShowBulkCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {selectedBatches.size} Batch Operation(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the selected batch operations. Cancelled operations cannot be restarted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkCancel} disabled={bulkCancel.isPending}>
              {bulkCancel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Operations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedBatches.size} Batch Operation(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected batch operations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {bulkDelete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Operations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
