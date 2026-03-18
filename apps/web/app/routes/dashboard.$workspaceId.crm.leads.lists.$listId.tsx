/**
 * Lead List Detail Page
 * View and manage a single lead list with members and custom field filters
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  Loader2,
  Target,
  CheckCircle,
  Plus,
  Trash2,
  Eye,
  Search,
  Calendar,
  Edit,
  Archive,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import {
  useContactList,
  useListMembers,
  useUpdateContactList,
  useDeleteContactList,
  useRemoveContactFromList,
} from '~/hooks/useEnrichment';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { DynamicListFilters, type CustomFieldFilters } from '~/components/crm/lists/DynamicListFilters';
import { ContactSelectionDialog } from '~/components/crm/lists/ContactSelectionDialog';
import { LeadStatusBadge } from '~/components/crm/LeadStatusBadge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

interface ListMember {
  id: string;
  listId: string;
  entityType: string;
  entityId: string;
  addedAt: string;
  addedBy: string | null;
  source: string;
  isActive: boolean;
  enrichmentScore: string | null;
  enrichedAt: string | null;
  entity: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    status: string;
    [key: string]: any;
  };
}

export default function LeadListDetailPage() {
  const navigate = useNavigate();
  const { listId } = useParams();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddLeadsDialog, setShowAddLeadsDialog] = useState(false);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilters>({});

  const { data: list, isLoading: listLoading } = useContactList(listId || '', workspaceId);
  const { data: membersData, isLoading: membersLoading } = useListMembers(
    listId || '',
    workspaceId,
    customFieldFilters
  );
  const members = membersData?.members || [];
  const updateList = useUpdateContactList();
  const deleteList = useDeleteContactList();
  const removeLead = useRemoveContactFromList();

  const isLoading = listLoading || membersLoading;

  // Initialize edit form when list loads
  useEffect(() => {
    if (list && !editedName) {
      setEditedName(list.name);
      setEditedDescription(list.description || '');
    }
  }, [list, editedName]);

  // Initialize filters from URL params on mount
  useEffect(() => {
    const urlFilters: CustomFieldFilters = {};
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('customField.')) {
        const filterKey = key.replace('customField.', '');
        // Try to parse as number if it looks like a number
        const numValue = Number(value);
        urlFilters[filterKey] = isNaN(numValue) ? value : numValue;
      }
    }
    if (Object.keys(urlFilters).length > 0) {
      setCustomFieldFilters(urlFilters);
    }
  }, []); // Only on mount

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/lists`);
  };

  const handleViewLead = (leadId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/${leadId}`);
  };

  // BUG-004 FIX: Update URL params when filters change
  const handleFiltersChange = (filters: CustomFieldFilters) => {
    const params = new URLSearchParams(searchParams);

    // Clear existing custom field filters
    for (const key of Array.from(params.keys())) {
      if (key.startsWith('customField.')) {
        params.delete(key);
      }
    }

    // Add new filters to URL
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '' && value !== 'all') {
        params.set(`customField.${key}`, String(value));
      }
    }

    // Update URL and state
    setSearchParams(params);
    setCustomFieldFilters(filters);
  };

  // BUG-003 FIX: Add cache invalidation
  const handleRemoveLead = async () => {
    if (!deleteLeadId || !listId) return;

    try {
      await removeLead.mutateAsync({
        listId,
        contactId: deleteLeadId,
        workspaceId,
      });

      // Invalidate queries to trigger refetch (using correct query keys from hooks)
      queryClient.invalidateQueries({ queryKey: ['crm', 'lists', listId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'lists', listId] });

      toast.success('Lead removed', { description: 'Lead has been removed from the list' });

      setDeleteLeadId(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleSaveSettings = async () => {
    if (!listId) return;

    try {
      const updateData: {
        listId: string;
        workspaceId: string;
        name: string;
        description?: string;
      } = {
        listId,
        workspaceId,
        name: editedName,
      };

      // Only include fields that have values
      if (editedDescription) {
        updateData.description = editedDescription;
      }

      await updateList.mutateAsync(updateData);

      toast.success('Settings saved', { description: 'Lead list settings have been updated' });

      setShowSettingsDialog(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleArchiveList = async () => {
    if (!listId) return;

    try {
      await updateList.mutateAsync({
        listId,
        workspaceId,
        status: 'archived',
      });

      toast.success('List archived', { description: 'Lead list has been archived' });

      handleBack();
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteList = async () => {
    if (!listId) return;

    try {
      await deleteList.mutateAsync({
        listId,
        workspaceId,
      });

      toast.success('List deleted', { description: 'Lead list has been deleted' });

      handleBack();
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      active: 'bg-green-600',
      archived: 'bg-gray-500',
      processing: 'bg-blue-500',
    };

    const labelMap: Record<string, string> = {
      active: 'Active',
      archived: 'Archived',
      processing: 'Processing',
    };

    return (
      <Badge className={colorMap[status] || 'bg-gray-500'}>
        {labelMap[status] || status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const labelMap: Record<string, string> = {
      manual: 'Manual',
      import: 'Import',
      campaign: 'Campaign',
      enrichment: 'Enrichment',
      segment: 'Segment',
    };

    return <Badge variant="outline">{labelMap[type] || type}</Badge>;
  };

  // Filter members based on search query
  const filteredMembers = members.filter((member: ListMember) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const entity = member.entity;
    return (
      entity.firstName?.toLowerCase().includes(query) ||
      entity.lastName?.toLowerCase().includes(query) ||
      entity.email?.toLowerCase().includes(query) ||
      entity.phone?.toLowerCase().includes(query) ||
      entity.companyName?.toLowerCase().includes(query)
    );
  });

  // Calculate stats
  const totalLeads = members.length;
  const activeLeads = members.filter((m: ListMember) => m.entity?.status === 'active' || m.entity?.status === 'new').length;
  const enrichedLeads = members.filter(
    (m: ListMember) => m.enrichedAt !== null
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-12">
        <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">List not found</h3>
        <p className="text-muted-foreground mb-4">
          The lead list you are looking for does not exist or has been deleted.
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Lists
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lists
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{list.name}</h1>
                {getStatusBadge(list.status)}
                {getTypeBadge(list.type)}
              </div>
              {list.description && (
                <p className="text-muted-foreground">{list.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created {new Date(list.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddLeadsDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Leads
          </Button>
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">All leads in list</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads > 0 ? Math.round((activeLeads / totalLeads) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enriched</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrichedLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads > 0 ? Math.round((enrichedLeads / totalLeads) * 100) : 0}% enriched
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Custom Field Filters */}
      {list.customFieldSchema && Object.keys(list.customFieldSchema).length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <DynamicListFilters
              listId={listId || ''}
              workspaceId={workspaceId}
              customFieldSchema={list.customFieldSchema}
              filters={customFieldFilters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={() => handleFiltersChange({})}
            />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>List Members</CardTitle>
                  <CardDescription>
                    All leads in this list ({filteredMembers.length} shown)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? 'No leads match your search' : 'No leads in this list yet'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowAddLeadsDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first lead
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Enriched</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member: ListMember) => (
                      <TableRow key={member.entity.id}>
                        <TableCell className="font-medium">
                          {member.entity.firstName} {member.entity.lastName}
                        </TableCell>
                        <TableCell>{member.entity.email || '—'}</TableCell>
                        <TableCell>{member.entity.phone || '—'}</TableCell>
                        <TableCell>{member.entity.companyName || '—'}</TableCell>
                        <TableCell>
                          <LeadStatusBadge status={member.entity.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(member.addedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {member.enrichedAt ? (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Enriched
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewLead(member.entity.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteLeadId(member.entity.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>List Settings</CardTitle>
              <CardDescription>Manage list configuration and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>List Name</Label>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter list name"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Enter list description"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveSettings} disabled={updateList.isPending}>
                  {updateList.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditedName(list.name);
                    setEditedDescription(list.description || '');
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions for this list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Archive this list</p>
                  <p className="text-sm text-muted-foreground">
                    Mark this list as archived. You can restore it later.
                  </p>
                </div>
                <Button variant="outline" onClick={handleArchiveList}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="font-medium text-destructive">Delete this list</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this list. Leads will not be deleted.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete List
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List Settings</DialogTitle>
            <DialogDescription>Update the settings for this lead list</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>List Name</Label>
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter list name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Enter list description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={updateList.isPending}>
              {updateList.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete List Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{list.name}". Leads in this list will not be deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              className="bg-destructive text-destructive-foreground"
            >
              Delete List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Lead Confirmation */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={() => setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Lead from List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the lead from this list. The lead record will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveLead}>Remove Lead</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Leads Dialog */}
      <ContactSelectionDialog
        open={showAddLeadsDialog}
        onOpenChange={setShowAddLeadsDialog}
        workspaceId={workspaceId}
        listId={listId || ''}
        entityType="lead"
        excludeEntityIds={members.map((m: ListMember) => m.entity.id)}
        onSuccess={() => {
          // BUG-003 FIX: Invalidate cache to refresh the UI (using correct query keys)
          queryClient.invalidateQueries({ queryKey: ['crm', 'lists', listId, 'members'] });
          queryClient.invalidateQueries({ queryKey: ['crm', 'lists', listId] });

          setShowAddLeadsDialog(false);
          toast.success('Leads added', { description: 'Selected leads have been added to the list' });
        }}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
