/**
 * ExecutionTimeline Component
 * Timeline visualization of workflow step execution history
 */

import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import {
  useEnrollment,
  useEnrollmentExecutions,
  type WorkflowExecution,
} from '~/hooks/useWorkflowEnrollments';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '~/components/ui/scroll-area';

interface ExecutionTimelineProps {
  enrollmentId: string;
  workspaceId: string;
  workflowSteps: Array<{ id: string; name: string; type: string }>;
}

const STATUS_ICONS = {
  completed: CheckCircle2,
  failed: XCircle,
  pending: Clock,
  running: AlertCircle,
};

const STATUS_COLORS = {
  completed: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  failed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  pending: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30',
  running: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
};

export function ExecutionTimeline({ enrollmentId, workspaceId, workflowSteps }: ExecutionTimelineProps) {
  const { data: enrollment, isLoading: enrollmentLoading } = useEnrollment(enrollmentId, workspaceId);
  const { data: executions = [], isLoading: executionsLoading } = useEnrollmentExecutions(
    enrollmentId,
    workspaceId
  );

  const isLoading = enrollmentLoading || executionsLoading;

  // Map executions to steps
  const getStepStatus = (stepId: string): 'completed' | 'failed' | 'running' | 'pending' => {
    const execution = executions.find((ex) => ex.stepId === stepId);
    if (!execution) {
      if (enrollment?.currentStepId === stepId) return 'running';
      return 'pending';
    }
    return execution.status;
  };

  const getStepExecution = (stepId: string): WorkflowExecution | undefined => {
    return executions.find((ex) => ex.stepId === stepId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Timeline</CardTitle>
        <CardDescription>
          Step-by-step execution progress
          {enrollment && (
            <Badge variant="outline" className="ml-2">
              {enrollment.status}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {!isLoading && (
          <ScrollArea className="h-[500px] pr-4">
            <div className="relative space-y-4">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

              {workflowSteps.map((step, index) => {
                const status = getStepStatus(step.id);
                const execution = getStepExecution(step.id);
                const Icon = STATUS_ICONS[status];
                const colorClass = STATUS_COLORS[status];

                return (
                  <div key={step.id} className="relative flex gap-4">
                    {/* Icon */}
                    <div
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">
                            {step.name}
                            <Badge variant="outline" className="ml-2 text-xs">
                              Step {index + 1}
                            </Badge>
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {step.type.replace(/_/g, ' ')}
                          </p>

                          {execution && (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <div>
                                Started: {format(new Date(execution.startedAt), 'PPp')}
                              </div>
                              <div>
                                Completed: {format(new Date(execution.completedAt), 'PPp')}
                              </div>
                              <div>
                                Duration: {execution.durationMs}ms
                              </div>
                              {execution.error && (
                                <div className="text-destructive mt-2">
                                  Error: {execution.error}
                                </div>
                              )}
                              {execution.output && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer hover:text-foreground">
                                    View output
                                  </summary>
                                  <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto">
                                    {JSON.stringify(execution.output, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          )}

                          {status === 'running' && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                              Currently executing...
                            </div>
                          )}

                          {status === 'pending' && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Waiting to execute
                            </div>
                          )}
                        </div>

                        <Badge
                          variant={status === 'failed' ? 'destructive' : 'secondary'}
                          className="shrink-0"
                        >
                          {status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Enrollment Summary */}
        {enrollment && (
          <div className="mt-6 pt-6 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Enrollment ID</span>
              <span className="font-mono text-xs">{enrollment.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDistanceToNow(new Date(enrollment.createdAt), { addSuffix: true })}</span>
            </div>
            {enrollment.lastExecutedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Executed</span>
                <span>{formatDistanceToNow(new Date(enrollment.lastExecutedAt), { addSuffix: true })}</span>
              </div>
            )}
            {enrollment.completedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{formatDistanceToNow(new Date(enrollment.completedAt), { addSuffix: true })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retry Count</span>
              <span>{enrollment.retryCount}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
