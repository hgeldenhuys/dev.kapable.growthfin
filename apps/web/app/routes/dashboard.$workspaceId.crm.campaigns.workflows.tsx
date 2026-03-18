/**
 * Campaign Workflows Management Page
 * List, create, activate, pause, and delete campaign workflows
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Trash2,
  Search,
  ArrowLeft,
  Filter,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Skeleton } from '~/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
import {
  useWorkflows,
  useCreateWorkflow,
  useActivateWorkflow,
  usePauseWorkflow,
  useDeleteWorkflow,
  type CampaignWorkflow,
} from '~/hooks/useCampaignWorkflows';
import { toast } from 'sonner';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// Status badge variant mapping
function getStatusBadge(status: CampaignWorkflow['status']) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case 'paused':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Paused</Badge>;
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>;
    case 'archived':
      return <Badge variant="secondary" className="opacity-60">Archived</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function CampaignWorkflowsPage() {
  const workspaceId = useWorkspaceId();
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<CampaignWorkflow | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');

  // Hooks
  const {
    data: workflows = [],
    isLoading,
    error,
  } = useWorkflows({
    workspaceId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const createWorkflow = useCreateWorkflow();
  const activateWorkflow = useActivateWorkflow();
  const pauseWorkflow = usePauseWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  // Filter by search query (client-side since the hook already filters by status)
  const filteredWorkflows = workflows.filter((workflow) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      workflow.name.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query)
    );
  });

  // Calculate stats from all workflows (not filtered)
  const stats = {
    total: workflows.length,
    draft: workflows.filter((w) => w.status === 'draft').length,
    active: workflows.filter((w) => w.status === 'active').length,
    paused: workflows.filter((w) => w.status === 'paused').length,
  };

  // Handlers
  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Validation Error', { description: 'Workflow name is required.' });
      return;
    }

    try {
      await createWorkflow.mutateAsync({
        workspaceId,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        tags: formTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        steps: [],
      });

      toast.success('Workflow Created', { description: `"${formName.trim()}" has been created as a draft.` });

      // Reset form and close dialog
      setFormName('');
      setFormDescription('');
      setFormTags('');
      setCreateDialogOpen(false);
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  const handleActivate = async (workflow: CampaignWorkflow) => {
    try {
      await activateWorkflow.mutateAsync({
        workflowId: workflow.id,
        workspaceId,
      });
      toast.success('Workflow Activated', { description: `"${workflow.name}" is now active.` });
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  const handlePause = async (workflow: CampaignWorkflow) => {
    try {
      await pauseWorkflow.mutateAsync({
        workflowId: workflow.id,
        workspaceId,
      });
      toast.success('Workflow Paused', { description: `"${workflow.name}" has been paused.` });
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  const handleDeleteClick = (workflow: CampaignWorkflow) => {
    setSelectedWorkflow(workflow);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedWorkflow) return;

    try {
      await deleteWorkflow.mutateAsync({
        workflowId: selectedWorkflow.id,
        workspaceId,
      });
      toast.success('Workflow Deleted', { description: `"${selectedWorkflow.name}" has been deleted.` });
      setDeleteDialogOpen(false);
      setSelectedWorkflow(null);
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading workflows: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/dashboard/${workspaceId}/crm/campaigns`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitBranch className="h-8 w-8" />
            Campaign Workflows
          </h1>
          <p className="text-muted-foreground">
            Automate multi-step campaign sequences
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All workflows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">Not yet activated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Play className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paused}</div>
            <p className="text-xs text-muted-foreground">Temporarily stopped</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workflows Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Workflows ({filteredWorkflows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredWorkflows.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No workflows match your filters'
                  : 'No workflows yet. Create your first workflow!'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first workflow
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead className="text-center">Enrollments</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Completion Rate</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">{workflow.name}</div>
                        {workflow.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {workflow.description}
                          </div>
                        )}
                        {workflow.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {workflow.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {workflow.steps?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" />
                        {workflow.enrollmentCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {workflow.activeEnrollmentCount}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {(workflow.completionRate * 100).toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(workflow.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Activate button - show for draft workflows */}
                        {workflow.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(workflow)}
                            disabled={activateWorkflow.isPending}
                            title="Activate workflow"
                          >
                            <Play className="h-4 w-4 text-green-600" />
                          </Button>
                        )}

                        {/* Pause button - show for active workflows */}
                        {workflow.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePause(workflow)}
                            disabled={pauseWorkflow.isPending}
                            title="Pause workflow"
                          >
                            <Pause className="h-4 w-4 text-yellow-600" />
                          </Button>
                        )}

                        {/* Delete button - show for draft and archived workflows */}
                        {(workflow.status === 'draft' || workflow.status === 'archived') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(workflow)}
                            disabled={deleteWorkflow.isPending}
                            title="Delete workflow"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Workflow Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                placeholder="e.g., Welcome Sequence"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                placeholder="Describe the purpose of this workflow..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-tags">Tags</Label>
              <Input
                id="workflow-tags"
                placeholder="e.g., onboarding, nurture, sales (comma-separated)"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple tags with commas
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setFormName('');
                setFormDescription('');
                setFormTags('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createWorkflow.isPending || !formName.trim()}
            >
              {createWorkflow.isPending ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedWorkflow?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWorkflow.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
