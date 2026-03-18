/**
 * Workflows List Route
 * View and manage campaign workflows
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { WorkflowList } from '~/components/crm/workflows/WorkflowList';
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
import { toast } from 'sonner';
import {
  useDeleteWorkflow,
  useActivateWorkflow,
  usePauseWorkflow,
  type CampaignWorkflow,
} from '~/hooks/useCampaignWorkflows';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function WorkflowsListRoute() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const deleteMutation = useDeleteWorkflow();
  const activateMutation = useActivateWorkflow();
  const pauseMutation = usePauseWorkflow();

  const [deletingWorkflow, setDeletingWorkflow] = useState<CampaignWorkflow | null>(null);

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  const handleViewWorkflow = (workflow: CampaignWorkflow) => {
    navigate(`/dashboard/${workspaceId}/crm/automation/workflows/${workflow.id}`);
  };

  const handleEditWorkflow = (workflow: CampaignWorkflow) => {
    navigate(`/dashboard/${workspaceId}/crm/automation/workflows/${workflow.id}/edit`);
  };

  const handleActivateWorkflow = async (workflow: CampaignWorkflow) => {
    try {
      await activateMutation.mutateAsync({
        workflowId: workflow.id,
        workspaceId,
      });

      toast.success('Workflow Activated', { description: `${workflow.name} is now active` });
    } catch (error: any) {
      toast.error('Activation Failed', { description: error.message });
    }
  };

  const handlePauseWorkflow = async (workflow: CampaignWorkflow) => {
    try {
      await pauseMutation.mutateAsync({
        workflowId: workflow.id,
        workspaceId,
      });

      toast.success('Workflow Paused', { description: `${workflow.name} has been paused` });
    } catch (error: any) {
      toast.error('Pause Failed', { description: error.message });
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!deletingWorkflow) return;

    try {
      await deleteMutation.mutateAsync({
        workflowId: deletingWorkflow.id,
        workspaceId,
      });

      toast.success('Workflow Deleted', { description: `${deletingWorkflow.name} has been deleted` });

      setDeletingWorkflow(null);
    } catch (error: any) {
      toast.error('Delete Failed', { description: error.message });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/automation/workflows/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </div>
      <WorkflowList
        workspaceId={workspaceId}
        onViewWorkflow={handleViewWorkflow}
        onEditWorkflow={handleEditWorkflow}
        onActivateWorkflow={handleActivateWorkflow}
        onPauseWorkflow={handlePauseWorkflow}
        onDeleteWorkflow={(workflow) => setDeletingWorkflow(workflow)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingWorkflow}
        onOpenChange={(open) => !open && setDeletingWorkflow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingWorkflow?.name}"? This action cannot be
              undone and will affect all enrollments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkflow}
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
