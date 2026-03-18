/**
 * Segment Detail Page
 * View segment details, metrics, and member leads
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Edit, Trash2, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
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
import { useSegment, useDeleteSegment, useRefreshSegment } from '~/hooks/useSegments';
import { toast } from 'sonner';
import { SegmentMetricsCard } from '~/components/crm/leads/SegmentMetricsCard';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function SegmentDetailPage() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch segment data
  const { data: segment, isLoading, error } = useSegment(segmentId!, workspaceId);
  const deleteSegment = useDeleteSegment();
  const refreshSegment = useRefreshSegment();

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/segments`);
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
    toast.success('Coming Soon', { description: 'Segment editing will be available soon' });
  };

  const handleDelete = async () => {
    if (!segmentId) return;

    try {
      await deleteSegment.mutateAsync({
        segmentId,
        workspaceId,
      });

      toast.success('Segment Deleted', { description: 'The segment has been deleted successfully' });

      navigate(`/dashboard/${workspaceId}/crm/leads/segments`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleRefresh = async () => {
    if (!segmentId) return;

    try {
      await refreshSegment.mutateAsync({
        segmentId,
        workspaceId,
      });

      toast.success('Refresh Started', { description: 'Segment membership is being recalculated' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleExport = () => {
    toast.success('Coming Soon', { description: 'Export functionality will be available soon' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading segment...</p>
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">
          Error loading segment: {error ? String(error) : 'Segment not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: segment.color || '#3B82F6' }}
            />
            <h1 className="text-3xl font-bold">{segment.name}</h1>
          </div>
          {segment.description && (
            <p className="text-muted-foreground mt-1">{segment.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshSegment.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshSegment.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={handleEdit}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <SegmentMetricsCard
        segmentId={segmentId!}
        workspaceId={workspaceId}
      />

      {/* Criteria Display */}
      <Card>
        <CardHeader>
          <CardTitle>Segment Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
            {JSON.stringify(segment.criteria, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Auto-Refresh Status */}
      {segment.autoRefresh && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-Refresh Enabled</p>
                <p className="text-xs text-muted-foreground">
                  Refreshes every {segment.refreshIntervalMinutes} minutes
                </p>
              </div>
              {segment.lastRefreshedAt && (
                <p className="text-xs text-muted-foreground">
                  Last refreshed: {new Date(segment.lastRefreshedAt).toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{segment.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
