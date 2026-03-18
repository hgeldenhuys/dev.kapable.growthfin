/**
 * Campaigns List Page
 * Main campaign management interface
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Megaphone, Search, Filter, Eye, Trash2 } from 'lucide-react';
import { EmptyState } from '~/components/crm/EmptyState';
import { ContextualHelp } from '~/components/crm/ContextualHelp';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { CampaignStatusBadge } from '~/components/campaigns/CampaignStatusBadge';
import { useCampaigns, useDeleteCampaign } from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { JsonExportButton } from '~/components/crm/JsonExportButton';
import { JsonImportButton } from '~/components/crm/JsonImportButton';
import { usePermissions, PermissionButton } from '~/hooks/usePermissions';
import type { Campaign } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignsPage() {
  const navigate = useNavigate();
  // Get workspace context and permissions
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { canCreate, canDeleteCampaign } = usePermissions();

  // Fetch campaigns
  const { data: campaigns = [], isLoading, error } = useCampaigns({ workspaceId });
  const deleteCampaign = useDeleteCampaign();

  // UI State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      searchQuery === '' ||
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort campaigns
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';
    if (sortField === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
    else if (sortField === 'status') { aVal = a.status; bVal = b.status; }
    else if (sortField === 'objective') { aVal = a.objective || ''; bVal = b.objective || ''; }
    else if (sortField === 'recipients') { aVal = a.calculatedAudienceSize || 0; bVal = b.calculatedAudienceSize || 0; }
    else if (sortField === 'createdAt') { aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Sortable header helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </TableHead>
  );

  // Navigation path for new campaign
  const newCampaignPath = `/dashboard/${workspaceId}/crm/campaigns/new`;

  // Handlers
  const handleView = (campaign: Campaign) => {
    navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaign.id}`);
  };

  const handleDelete = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCampaign) return;

    try {
      await deleteCampaign.mutateAsync({
        campaignId: selectedCampaign.id,
        workspaceId,
      });
      toast.success('Campaign deleted', { description: 'The campaign has been deleted successfully.' });
      setDeleteDialogOpen(false);
      setSelectedCampaign(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Calculate stats
  const stats = {
    total: campaigns.length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    active: campaigns.filter((c) => c.status === 'active').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
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
        <p className="text-destructive">Error loading campaigns: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Campaigns
            <ContextualHelp topic="campaigns" workspaceId={workspaceId} />
          </h1>
          <p className="text-muted-foreground">
            Manage your marketing campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JsonExportButton entityType="campaigns" data={campaigns} variant="outline" size="sm" />
          <JsonImportButton
            entityType="campaigns"
            workspaceId={workspaceId}
            userId={userId}
            onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['crm', 'campaigns'] })}
            variant="outline"
            size="sm"
          />
          {canCreate && (
            <Button asChild>
              <Link to={newCampaignPath}>
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">Not yet started</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Finished campaigns</p>
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
                  placeholder="Search campaigns..."
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
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns ({filteredCampaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCampaigns.length === 0 ? (
            searchQuery || statusFilter !== 'all' ? (
              <div className="text-center py-8">
                <Megaphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No campaigns match your filters</p>
              </div>
            ) : (
              <EmptyState
                icon={<Megaphone />}
                title="No campaigns yet"
                description="Create your first campaign to reach your leads at scale via email or SMS."
                workspaceId={workspaceId}
                guideStep={8}
                guideLabel="Learn how to create campaigns"
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link to={newCampaignPath}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Campaign
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <SortableHeader field="name" label="Name" />
                  <SortableHeader field="status" label="Status" />
                  <SortableHeader field="objective" label="Objective" />
                  <SortableHeader field="recipients" label="Recipients" />
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Clicked</TableHead>
                  <SortableHeader field="createdAt" label="Created" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    data-testid={`campaign-row-${campaign.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(campaign)}
                  >
                    <TableCell className="font-medium" data-testid="campaign-name">
                      {campaign.name}
                    </TableCell>
                    <TableCell data-testid="campaign-status">
                      <CampaignStatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {campaign.objective.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {campaign.calculatedAudienceSize || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider delayDuration={300}>
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaign.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View</TooltipContent>
                          </Tooltip>
                          {campaign.status === 'draft' && canDeleteCampaign && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(campaign)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCampaign?.name}"? This action cannot be
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
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
