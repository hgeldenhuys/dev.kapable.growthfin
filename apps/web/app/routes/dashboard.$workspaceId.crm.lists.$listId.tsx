/**
 * Contact List Detail Page
 * View and manage a single contact list with members, activity, and settings
 *
 * Architecture (US-007):
 * - Loader: Fetches initial tasks from database via Drizzle ORM
 * - SSE: Real-time updates via useTasksSSE hook
 * - Mutations: useDeleteTask triggers revalidation
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ArrowLeft,
  Loader2,
  Users,
  DollarSign,
  CheckCircle,
  TrendingUp,
  Plus,
  Trash2,
  Eye,
  Search,
  Calendar,
  Edit,
  Archive,
  Combine,
  Filter,
  MoreVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import {
  useContactList,
  useListMembers,
  useUpdateContactList,
  useDeleteContactList,
  useRemoveContactFromList,
} from '~/hooks/useEnrichment';
import { toast } from 'sonner';
import type { Contact } from '~/types/crm';
import { DynamicListFilters, type CustomFieldFilters } from '~/components/crm/lists/DynamicListFilters';
import { ListOperationsModal } from '~/components/crm/lists/ListOperationsModal';
import { CreateFromFiltersDialog } from '~/components/crm/lists/CreateFromFiltersDialog';
import { ContactSelectionDialog } from '~/components/crm/lists/ContactSelectionDialog';
import { useDeleteTask } from '~/hooks/useTasks';
import { useTasksSSE } from '~/hooks/useTasksSSE';
import { TaskPlanningModal } from '~/components/crm/tasks/TaskPlanningModal';
import { TaskStatusBadge } from '~/components/crm/tasks/TaskStatusBadge';
import { TaskTypeBadge } from '~/components/crm/tasks/TaskTypeBadge';
import type { Task } from '~/hooks/useTasks';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for list detail page
 * Fetches tasks for this specific list from database using Drizzle ORM
 */
export async function loader({ params }: LoaderFunctionArgs) {
  // Import server-only modules inside the loader to prevent client bundling
  const { db, crmTasks, eq, desc, and } = await import('~/lib/db.server');

  const { workspaceId, listId } = params;

  if (!workspaceId || !listId) {
    return { tasks: [] };
  }

  // Fetch tasks for this specific list
  const tasks = await db
    .select()
    .from(crmTasks)
    .where(and(eq(crmTasks.workspaceId, workspaceId), eq(crmTasks.listId, listId)))
    .orderBy(desc(crmTasks.createdAt));

  return { tasks };
}

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
    companyName?: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    status: string;
    customFields?: Record<string, any>;
    [key: string]: any;
  };
}

export default function ContactListDetailPage() {
  const navigate = useNavigate();
  const { listId } = useParams();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOperationsModal, setShowOperationsModal] = useState(false);
  const [showCreateFromFiltersDialog, setShowCreateFromFiltersDialog] = useState(false);
  const [showTaskPlanningModal, setShowTaskPlanningModal] = useState(false);
  const [showAddContactsDialog, setShowAddContactsDialog] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedBudget, setEditedBudget] = useState('');
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilters>({});

  const { data: list, isLoading: listLoading } = useContactList(listId || '', workspaceId);
  const { data: membersData, isLoading: membersLoading } = useListMembers(
    listId || '',
    workspaceId,
    customFieldFilters
  );
  const updateList = useUpdateContactList();
  const deleteList = useDeleteContactList();
  const removeContact = useRemoveContactFromList();

  // Task data from loader (US-007: React Router loader pattern)
  const loaderData = useLoaderData<typeof loader>();
  const tasks = (loaderData?.tasks || []) as Task[];

  // Subscribe to SSE for real-time updates (US-007: AC-002)
  useTasksSSE(workspaceId);

  const deleteTask = useDeleteTask();
  const queryClient = useQueryClient();

  // Subscribe to SSE for list members real-time updates
  // When leads/contacts are modified, invalidate the list members query
  useEffect(() => {
    if (!list?.entityType || !workspaceId || !listId) return;

    // Map entity type to table name
    const tableMap: Record<string, string> = {
      lead: 'crm_leads',
      contact: 'crm_contacts',
      account: 'crm_accounts',
      opportunity: 'crm_opportunities',
    };
    const table = tableMap[list.entityType];
    if (!table) return;

    const params = new URLSearchParams({
      table,
      where: `workspace_id = '${workspaceId}'`,
    });
    const streamUrl = `/api/v1/stream?${params.toString()}`;

    const sse = new EventSource(streamUrl);

    sse.onmessage = () => {
      // Invalidate list members query when entities change
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', listId, 'members', workspaceId],
      });
    };

    sse.onerror = () => {
      if (sse.readyState === EventSource.CLOSED) {
        sse.close();
      }
    };

    return () => sse.close();
  }, [list?.entityType, workspaceId, listId, queryClient]);

  const members = membersData?.members || [];
  const customFieldSchema = membersData?.customFieldSchema || {};

  // The schema keys should already be normalized field names (after backend fix)
  // But for backward compatibility with old schemas, we'll handle both formats
  const schemaEntries = Object.entries(customFieldSchema).filter(([key]) => key !== '');

  const isLoading = listLoading || membersLoading;

  // Track active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(customFieldFilters).filter(
      (v) => v !== null && v !== 'all' && v !== undefined && v !== ''
    ).length;
  }, [customFieldFilters]);

  const hasActiveFilters = activeFilterCount > 0;

  // Initialize edit form when list loads
  useEffect(() => {
    if (list && !editedName) {
      setEditedName(list.name);
      setEditedDescription(list.description || '');
      setEditedBudget(list.budgetLimit || '');
    }
  }, [list, editedName]);

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/lists`);
  };

  const handleViewContact = (contactId: string) => {
    // Route based on entity type (lead vs contact)
    const entityType = list?.entityType || 'contact';
    const route = entityType === 'lead' ? 'leads' : 'contacts';
    navigate(`/dashboard/${workspaceId}/crm/${route}/${contactId}`);
  };

  const handleRemoveContact = async () => {
    if (!deleteContactId || !listId) return;

    try {
      await removeContact.mutateAsync({
        listId,
        memberId: deleteContactId,
        workspaceId,
      });

      toast.success('Contact removed', { description: 'Contact has been removed from the list' });

      setDeleteContactId(null);
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
        budgetLimit?: string;
      } = {
        listId,
        workspaceId,
        name: editedName,
      };

      // Only include fields that have values
      if (editedDescription) {
        updateData.description = editedDescription;
      }
      if (editedBudget) {
        updateData.budgetLimit = editedBudget;
      }

      await updateList.mutateAsync(updateData);

      toast.success('Settings saved', { description: 'Contact list settings have been updated' });

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

      toast.success('List archived', { description: 'Contact list has been archived' });

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

      toast.success('List deleted', { description: 'Contact list has been deleted' });

      handleBack();
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;

    try {
      await deleteTask.mutateAsync({
        taskId: deleteTaskId,
        workspaceId,
      });

      toast.success('Task deleted', { description: 'Task has been deleted successfully' });

      setDeleteTaskId(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleTaskClick = (task: Task) => {
    navigate(`/dashboard/${workspaceId}/crm/batches/${task.id}`);
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
      entity.companyName?.toLowerCase().includes(query) ||
      entity.email?.toLowerCase().includes(query) ||
      entity.phone?.toLowerCase().includes(query) ||
      entity.title?.toLowerCase().includes(query)
    );
  });

  // Calculate stats
  const totalContacts = members.length;
  const activeContacts = members.filter((m: ListMember) => m.entity?.status === 'active').length;
  // Only count as enriched if enrichedAt is explicitly set (not null, undefined, or empty string)
  const enrichedContacts = members.filter(
    (m: ListMember) => m.enrichedAt !== null && m.enrichedAt !== undefined && m.enrichedAt !== ''
  ).length;
  const totalSpent = members.reduce((sum: number, m: ListMember) => {
    return sum + (parseFloat(m.enrichmentScore || '0') || 0);
  }, 0);

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
        <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">List not found</h3>
        <p className="text-muted-foreground mb-4">
          The contact list you are looking for does not exist or has been deleted.
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
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="outline" onClick={() => setShowCreateFromFiltersDialog(true)}>
              <Filter className="mr-2 h-4 w-4" />
              Create List from Filters
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setShowOperationsModal(true)}>
            <Combine className="mr-2 h-4 w-4" />
            Operations
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContacts}</div>
            <p className="text-xs text-muted-foreground">All contacts in list</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContacts}</div>
            <p className="text-xs text-muted-foreground">
              {totalContacts > 0 ? Math.round((activeContacts / totalContacts) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enriched via API</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrichedContacts}</div>
            <p className="text-xs text-muted-foreground">
              {totalContacts > 0 ? Math.round((enrichedContacts / totalContacts) * 100) : 0}% enriched by external services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Used</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {list.budgetLimit
                ? `of $${parseFloat(list.budgetLimit).toFixed(2)} limit`
                : 'No limit set'}
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
              onFiltersChange={setCustomFieldFilters}
              onClearFilters={() => setCustomFieldFilters({})}
            />
          </CardContent>
        </Card>
      )}

      {/* Main Content with Tabs */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>List Members</CardTitle>
                  <CardDescription>
                    All contacts in this list ({filteredMembers.length} shown)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button onClick={() => setShowAddContactsDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contacts
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? 'No contacts match your search' : 'No contacts in this list yet'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowAddContactsDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first contact
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
                      <TableHead>Title</TableHead>
                      {/* Dynamic custom field columns */}
                      {schemaEntries.map(([fieldKey, fieldDef]: [string, any]) => (
                        <TableHead key={fieldKey}>{fieldDef.label}</TableHead>
                      ))}
                      <TableHead>Added</TableHead>
                      <TableHead>Enriched</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member: ListMember) => (
                      <TableRow
                        key={member.entity.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewContact(member.entity.id)}
                      >
                        <TableCell className="font-medium">
                          {member.entity.firstName} {member.entity.lastName}
                          {member.entity.companyName && (
                            <div className="text-xs text-muted-foreground">{member.entity.companyName}</div>
                          )}
                        </TableCell>
                        <TableCell>{member.entity.email || '—'}</TableCell>
                        <TableCell>{member.entity.phone || '—'}</TableCell>
                        <TableCell>{member.entity.title || '—'}</TableCell>
                        {/* Dynamic custom field values */}
                        {schemaEntries.map(([fieldKey]) => (
                          <TableCell key={fieldKey}>
                            {member.entity.customFields?.[fieldKey] || '—'}
                          </TableCell>
                        ))}
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
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteContactId(member.id)}
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

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>List Activity</CardTitle>
              <CardDescription>Timeline of actions on this list</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Activity tracking coming soon</p>
              </div>
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

              <div className="space-y-2">
                <Label>Budget Limit</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editedBudget}
                  onChange={(e) => setEditedBudget(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum budget for enrichment operations on this list
                </p>
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
                    setEditedBudget(list.budgetLimit || '');
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
                    Permanently delete this list. Contacts will not be deleted.
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
        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Planned Tasks</CardTitle>
                  <CardDescription>Tasks associated with this list</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowTaskPlanningModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Plan Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No tasks planned for this list yet</p>
                  <Button variant="outline" onClick={() => setShowTaskPlanningModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Plan your first task
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.map((task) => (
                    <Card
                      key={task.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleTaskClick(task)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TaskTypeBadge type={task.type as any} />
                          <TaskStatusBadge status={task.status as any} />
                        </div>
                        <p className="font-medium truncate">{task.name}</p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex justify-end mt-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteTaskId(task.id); }}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List Settings</DialogTitle>
            <DialogDescription>Update the settings for this contact list</DialogDescription>
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

            <div className="space-y-2">
              <Label>Budget Limit ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={editedBudget}
                onChange={(e) => setEditedBudget(e.target.value)}
                placeholder="0.00"
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
            <AlertDialogTitle>Delete Contact List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{list.name}". Contacts in this list will not be deleted.
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

      {/* Remove Contact Confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Contact from List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the contact from this list. The contact record will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveContact}>Remove Contact</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* List Operations Modal */}
      {showOperationsModal && (
        <ListOperationsModal
          listId={listId || ''}
          listName={list.name}
          entityType={list.entityType}
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setShowOperationsModal(false)}
          onSuccess={(newListId) => {
            setShowOperationsModal(false);
            navigate(`/dashboard/${workspaceId}/crm/lists/${newListId}`);
          }}
        />
      )}

      {/* Create From Filters Dialog */}
      {showCreateFromFiltersDialog && (
        <CreateFromFiltersDialog
          open={showCreateFromFiltersDialog}
          onOpenChange={setShowCreateFromFiltersDialog}
          sourceListId={listId || ''}
          sourceListName={list.name}
          filters={customFieldFilters}
          estimatedCount={members.length}
          workspaceId={workspaceId}
          userId={userId}
        />
      )}

      {/* Task Planning Modal */}
      {showTaskPlanningModal && (
        <TaskPlanningModal
          open={showTaskPlanningModal}
          onOpenChange={setShowTaskPlanningModal}
          listId={listId || ''}
          listName={list.name}
          workspaceId={workspaceId}
          userId={userId}
          onSuccess={(taskId) => {
            setShowTaskPlanningModal(false);
          }}
        />
      )}

      {/* Add Contacts Dialog */}
      <ContactSelectionDialog
        open={showAddContactsDialog}
        onOpenChange={setShowAddContactsDialog}
        workspaceId={workspaceId}
        listId={listId || ''}
        entityType={(list?.entityType as 'contact' | 'lead') || 'contact'}
        excludeEntityIds={members.map((m: ListMember) => m.entityId)}
        onSuccess={() => {
          // Query invalidation happens in the dialog
        }}
      />

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this task. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
