/**
 * Create Workflow Route
 * Wizard for creating new workflows
 */

import { useParams, useNavigate } from 'react-router';
import { WorkflowBuilder } from '~/components/crm/workflows/WorkflowBuilder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import type { CampaignWorkflow } from '~/hooks/useCampaignWorkflows';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CreateWorkflowRoute() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  const handleSuccess = (workflow: CampaignWorkflow) => {
    navigate(`/dashboard/${workspaceId}/crm/automation/workflows/${workflow.id}`);
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/automation/workflows`);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Workflow</h1>
        <p className="text-muted-foreground mt-1">
          Build a multi-step campaign automation workflow
        </p>
      </div>

      <WorkflowBuilder
        workspaceId={workspaceId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
