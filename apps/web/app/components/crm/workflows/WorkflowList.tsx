/**
 * WorkflowList Component
 * Display list of workflows with status and metrics
 */

import { Play, Pause, Eye, Edit, Trash2, Users, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useWorkflows, useWorkflowStream, type CampaignWorkflow } from '~/hooks/useCampaignWorkflows';
import { Skeleton } from '~/components/ui/skeleton';
import { format } from 'date-fns';

interface WorkflowListProps {
  workspaceId: string;
  onViewWorkflow?: (workflow: CampaignWorkflow) => void;
  onEditWorkflow?: (workflow: CampaignWorkflow) => void;
  onActivateWorkflow?: (workflow: CampaignWorkflow) => void;
  onPauseWorkflow?: (workflow: CampaignWorkflow) => void;
  onDeleteWorkflow?: (workflow: CampaignWorkflow) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function WorkflowList({
  workspaceId,
  onViewWorkflow,
  onEditWorkflow,
  onActivateWorkflow,
  onPauseWorkflow,
  onDeleteWorkflow,
}: WorkflowListProps) {
  const { data: workflows = [], isLoading, error } = useWorkflows({
    workspaceId,
  });

  // Real-time updates via SSE
  useWorkflowStream(workspaceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Campaign Workflows</h2>
        <p className="text-muted-foreground">
          Automate multi-step campaign sequences
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load workflows</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflows Table */}
      {!isLoading && !error && workflows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <button
                          onClick={() => onViewWorkflow?.(workflow)}
                          className="font-medium hover:text-primary hover:underline text-left"
                        >
                          {workflow.name}
                        </button>
                        {workflow.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {workflow.description}
                          </p>
                        )}
                        {(workflow.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(workflow.tags ?? []).slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {(workflow.tags ?? []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(workflow.tags ?? []).length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[workflow.status]}>
                        {workflow.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        {(workflow.steps ?? []).length} steps
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{workflow.activeEnrollmentCount ?? 0} active</span>
                        <span className="text-muted-foreground">/ {workflow.enrollmentCount ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        {(workflow.completionRate ?? 0).toFixed(1)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(workflow.updatedAt), 'PPp')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onViewWorkflow && (
                            <DropdownMenuItem onClick={() => onViewWorkflow(workflow)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          )}
                          {onEditWorkflow && (
                            <DropdownMenuItem onClick={() => onEditWorkflow(workflow)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {workflow.status === 'draft' && onActivateWorkflow && (
                            <DropdownMenuItem onClick={() => onActivateWorkflow(workflow)}>
                              <Play className="mr-2 h-4 w-4" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {workflow.status === 'active' && onPauseWorkflow && (
                            <DropdownMenuItem onClick={() => onPauseWorkflow(workflow)}>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          {onDeleteWorkflow && (
                            <DropdownMenuItem
                              onClick={() => onDeleteWorkflow(workflow)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && workflows.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No workflows found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Use the Actions panel to create your first workflow
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
