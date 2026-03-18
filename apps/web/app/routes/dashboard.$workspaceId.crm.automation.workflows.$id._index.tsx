/**
 * Workflow Detail Route
 * View workflow details, enrollments, and execution timeline
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Play, Pause, Edit, Users, TrendingUp } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Skeleton } from '~/components/ui/skeleton';
import { ExecutionTimeline } from '~/components/crm/workflows/ExecutionTimeline';
import { EnrollmentCard } from '~/components/crm/workflows/EnrollmentCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { toast } from 'sonner';
import {
  useWorkflow,
  useActivateWorkflow,
  usePauseWorkflow,
} from '~/hooks/useCampaignWorkflows';
import {
  useWorkflowEnrollments,
  useCancelEnrollment,
  useCompleteEnrollment,
  type WorkflowEnrollment,
} from '~/hooks/useWorkflowEnrollments';
import { format } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-red-100 text-red-800',
};

export default function WorkflowDetailRoute() {
  const { workspaceId, id: workflowId } = useParams<{ workspaceId: string; id: string }>();
  const navigate = useNavigate();
  const { data: workflow, isLoading } = useWorkflow(workflowId!, workspaceId!);
  const { data: enrollments = [] } = useWorkflowEnrollments({
    workflowId: workflowId!,
    workspaceId: workspaceId!,
  });

  const activateMutation = useActivateWorkflow();
  const pauseMutation = usePauseWorkflow();
  const cancelEnrollmentMutation = useCancelEnrollment();
  const completeEnrollmentMutation = useCompleteEnrollment();

  const [selectedEnrollment, setSelectedEnrollment] = useState<WorkflowEnrollment | null>(null);

  if (!workspaceId || !workflowId) {
    return <div>Invalid parameters</div>;
  }

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync({ workflowId, workspaceId });
      toast.success('Workflow Activated', { description: 'Workflow is now active and accepting enrollments' });
    } catch (error: any) {
      toast.error('Activation Failed', { description: error.message });
    }
  };

  const handlePause = async () => {
    try {
      await pauseMutation.mutateAsync({ workflowId, workspaceId });
      toast.success('Workflow Paused', { description: 'Workflow has been paused' });
    } catch (error: any) {
      toast.error('Pause Failed', { description: error.message });
    }
  };

  const handleCancelEnrollment = async (enrollment: WorkflowEnrollment) => {
    try {
      await cancelEnrollmentMutation.mutateAsync({
        enrollmentId: enrollment.id,
        workspaceId,
      });
      toast.success('Enrollment Cancelled', { description: 'Lead enrollment has been cancelled' });
    } catch (error: any) {
      toast.error('Cancel Failed', { description: error.message });
    }
  };

  const handleCompleteEnrollment = async (enrollment: WorkflowEnrollment) => {
    try {
      await completeEnrollmentMutation.mutateAsync({
        enrollmentId: enrollment.id,
        workspaceId,
      });
      toast.success('Enrollment Completed', { description: 'Lead enrollment has been completed' });
    } catch (error: any) {
      toast.error('Complete Failed', { description: error.message });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!workflow) {
    return <div className="container mx-auto p-6">Workflow not found</div>;
  }

  const statusColor = STATUS_COLORS[workflow.status] || STATUS_COLORS.draft;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/automation/workflows`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            <Badge className={statusColor}>{workflow.status}</Badge>
          </div>

          {workflow.description && (
            <p className="text-muted-foreground">{workflow.description}</p>
          )}

          {(workflow.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(workflow.tags ?? []).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {workflow.status === 'draft' && (
            <Button onClick={handleActivate}>
              <Play className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
          {workflow.status === 'active' && (
            <Button variant="outline" onClick={handlePause}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/dashboard/${workspaceId}/crm/automation/workflows/new?edit=${workflowId}`)
            }
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{workflow.enrollmentCount ?? 0}</div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{workflow.activeEnrollmentCount ?? 0}</div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{(workflow.completionRate ?? 0).toFixed(1)}%</div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments ({enrollments.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Steps</CardTitle>
              <CardDescription>
                {(workflow.steps ?? []).length} steps configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(workflow.steps ?? []).map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Badge variant="outline">Step {index + 1}</Badge>
                    <div className="flex-1">
                      <p className="font-medium">{step.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {step.type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(workflow.createdAt), 'PPpp')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">{format(new Date(workflow.updatedAt), 'PPpp')}</p>
            </div>
          </div>
        </TabsContent>

        {/* Enrollments Tab */}
        <TabsContent value="enrollments" className="space-y-4">
          {enrollments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No enrollments yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => (
                <EnrollmentCard
                  key={enrollment.id}
                  enrollment={enrollment}
                  onView={(e) => setSelectedEnrollment(e)}
                  onCancel={handleCancelEnrollment}
                  onComplete={handleCompleteEnrollment}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Enrollment Timeline Dialog */}
      {selectedEnrollment && (
        <Dialog
          open={!!selectedEnrollment}
          onOpenChange={(open) => !open && setSelectedEnrollment(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Enrollment Timeline</DialogTitle>
              <DialogDescription>
                Step-by-step execution progress for this lead
              </DialogDescription>
            </DialogHeader>
            <ExecutionTimeline
              enrollmentId={selectedEnrollment.id}
              workspaceId={workspaceId}
              workflowSteps={workflow.steps ?? []}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
