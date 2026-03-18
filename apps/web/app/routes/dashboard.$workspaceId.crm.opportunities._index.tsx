/**
 * Opportunities Pipeline Page
 * Main opportunity management interface with kanban board
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, TrendingUp, Search, Filter, BarChart3, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { OpportunityKanban } from '~/components/crm/OpportunityKanban';
import { OpportunityForm } from '~/components/crm/OpportunityForm';
import {
  useOpportunities,
  useCreateOpportunity,
  useUpdateOpportunity,
  useDeleteOpportunity,
  useChangeOpportunityStage,
} from '~/hooks/useOpportunities';
import { useAccounts } from '~/hooks/useAccounts';
import { useContacts } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { Opportunity, UpdateOpportunityRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function OpportunitiesPage() {
  const navigate = useNavigate();
  // Get workspace context
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch opportunities with real-time updates
  const { data: opportunities = [], isLoading, error, isLeader } = useOpportunities({ workspaceId });
  const updateOpportunity = useUpdateOpportunity();
  const deleteOpportunity = useDeleteOpportunity();
  const changeStage = useChangeOpportunityStage();
  const createOpportunity = useCreateOpportunity();

  // Fetch accounts and contacts for name lookups on opportunity cards
  const { data: accounts = [] } = useAccounts({ workspaceId });
  const { data: contacts = [] } = useContacts({ workspaceId });

  const accountNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.id, a.name);
    return map;
  }, [accounts]);

  const contactNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts) map.set(c.id, `${c.firstName} ${c.lastName}`);
    return map;
  }, [contacts]);

  // UI State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Filter opportunities
  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      searchQuery === '' ||
      opp.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || opp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleEdit = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setEditDialogOpen(true);
  };

  const handleDelete = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setDeleteDialogOpen(true);
  };

  const handleView = (opportunity: Opportunity) => {
    navigate(`/dashboard/${workspaceId}/crm/opportunities/${opportunity.id}`);
  };

  const handleSubmit = async (data: Partial<UpdateOpportunityRequest>) => {
    if (!selectedOpportunity) return;

    try {
      await updateOpportunity.mutateAsync({
        opportunityId: selectedOpportunity.id,
        workspaceId,
        data: data as UpdateOpportunityRequest,
      });
      toast.success('Opportunity updated', { description: 'The opportunity has been updated successfully.' });
      setEditDialogOpen(false);
      setSelectedOpportunity(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedOpportunity) return;

    try {
      await deleteOpportunity.mutateAsync({
        opportunityId: selectedOpportunity.id,
        workspaceId,
      });
      toast.success('Opportunity deleted', { description: 'The opportunity has been deleted successfully.' });
      setDeleteDialogOpen(false);
      setSelectedOpportunity(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleStageChange = async (opportunityId: string, newStage: string, probability: number) => {
    try {
      await changeStage.mutateAsync({
        opportunityId,
        workspaceId,
        stage: newStage,
        probability,
        updatedById: userId,
      });
      toast.success('Stage updated', { description: `Opportunity moved to ${newStage}` });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCreateSubmit = async (data: Partial<UpdateOpportunityRequest>) => {
    try {
      await createOpportunity.mutateAsync({
        ...data,
        workspaceId,
        createdById: userId,
      } as any);
      toast.success('Opportunity created', { description: 'The opportunity has been created successfully.' });
      setCreateDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Stats
  const stats = {
    total: opportunities.filter(o => o.status === 'open').length,
    totalValue: opportunities
      .filter(o => o.status === 'open')
      .reduce((sum, o) => sum + parseFloat(o.amount || '0'), 0),
    weightedValue: opportunities
      .filter(o => o.status === 'open')
      .reduce((sum, o) => sum + (parseFloat(o.amount || '0') * o.probability / 100), 0),
    won: opportunities.filter(o => o.status === 'won').length,
    wonValue: opportunities
      .filter(o => o.status === 'won')
      .reduce((sum, o) => sum + parseFloat(o.amount || '0'), 0),
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading opportunities: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Sales Pipeline
            {isLeader && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-green-600 dark:text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 rounded-full opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 bg-green-500 rounded-full"></span>
                </span>
                Live
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
            Manage your sales opportunities • Real-time updates
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Opportunity
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Opportunities</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Active in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">All open opportunities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weighted Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.weightedValue)}</div>
            <p className="text-xs text-muted-foreground">Based on probability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed Won</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.wonValue)}</div>
            <p className="text-xs text-muted-foreground">{stats.won} opportunities</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities..."
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/opportunities/forecast`)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Forecast
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div data-tour="pipeline-board">
      <OpportunityKanban
        opportunities={filteredOpportunities}
        onStageChange={handleStageChange}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleView}
        isLoading={changeStage.isPending}
        accountNames={accountNames}
        contactNames={contactNames}
      />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
            <DialogDescription>
              Update opportunity information
            </DialogDescription>
          </DialogHeader>
          <OpportunityForm
            opportunity={selectedOpportunity}
            onSubmit={handleSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={updateOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="opportunity-form"
              disabled={updateOpportunity.isPending}
            >
              {updateOpportunity.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedOpportunity?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Opportunity</DialogTitle>
            <DialogDescription>
              Create a new sales opportunity
            </DialogDescription>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleCreateSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="opportunity-form"
              disabled={createOpportunity.isPending}
            >
              {createOpportunity.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
