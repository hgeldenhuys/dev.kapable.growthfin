/**
 * Lists Management Page
 * View and manage lists for any entity type (leads, contacts, accounts, opportunities)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Users, Calendar, DollarSign, Plus } from 'lucide-react';
import { EmptyState } from '~/components/crm/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useContactLists, useDeleteContactList, useCreateContactList } from '~/hooks/useEnrichment';
import { toast } from 'sonner';
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
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type EntityType = 'all' | 'lead' | 'contact' | 'account' | 'opportunity';

export default function ContactListsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListEntityType, setNewListEntityType] = useState<'lead' | 'contact' | 'account' | 'opportunity'>('contact');

  const { data: lists = [], isLoading } = useContactLists(
    workspaceId,
    selectedEntityType === 'all' ? undefined : selectedEntityType
  );
  const deleteList = useDeleteContactList();
  const createList = useCreateContactList();

  const handleViewList = (listId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/lists/${listId}`);
  };

  const handleDeleteList = async () => {
    if (!deleteListId) return;

    try {
      await deleteList.mutateAsync({
        listId: deleteListId,
        workspaceId,
      });

      toast.success('List deleted', { description: 'Contact list has been deleted successfully' });

      setDeleteListId(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('Error', { description: 'List name is required' });
      return;
    }

    try {
      await createList.mutateAsync({
        workspaceId,
        name: newListName.trim(),
        description: newListDescription.trim() || undefined,
        type: 'manual',
        entityType: newListEntityType,
      });
      toast.success('List created', { description: `"${newListName}" has been created successfully` });
      setCreateDialogOpen(false);
      setNewListName('');
      setNewListDescription('');
      setNewListEntityType('contact');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Lists
          </h1>
          <p className="text-muted-foreground">
            Organize {selectedEntityType === 'all' ? 'entities' : `${selectedEntityType}s`} into lists for enrichment and campaigns
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Entity Type Filter */}
          <Select value={selectedEntityType} onValueChange={(value) => setSelectedEntityType(value as EntityType)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lists</SelectItem>
              <SelectItem value="lead">Lead Lists</SelectItem>
              <SelectItem value="contact">Contact Lists</SelectItem>
              <SelectItem value="account">Account Lists</SelectItem>
              <SelectItem value="opportunity">Opportunity Lists</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New List
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lists.length}</div>
            <p className="text-xs text-muted-foreground">All lists</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Lists</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.filter((l) => l.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.reduce((acc, l) => acc + l.totalContacts, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all lists</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg List Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.length > 0
                ? Math.round(lists.reduce((acc, l) => acc + l.totalContacts, 0) / lists.length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Contacts per list</p>
          </CardContent>
        </Card>
      </div>

      {/* Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contact Lists</CardTitle>
        </CardHeader>
        <CardContent>
          {lists.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No contact lists yet"
              description="Create named groups of leads or contacts to organize your pipeline and use as campaign audiences."
              workspaceId={workspaceId}
              guideStep={6}
              guideLabel="Learn how to create lists"
              action={
                <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first list
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow
                    key={list.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewList(list.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{list.name}</p>
                        {list.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {list.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(list.type)}</TableCell>
                    <TableCell>{getStatusBadge(list.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{list.totalContacts}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {list.budgetLimit ? (
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span>{parseFloat(list.budgetLimit).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(list.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewList(list.id);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteListId(list.id);
                          }}
                        >
                          Delete
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

      {/* Create List Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Create a new list to organize your entities for enrichment and campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                placeholder="e.g. Q1 Prospects"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-entity-type">Entity Type</Label>
              <Select value={newListEntityType} onValueChange={(v) => setNewListEntityType(v as typeof newListEntityType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-description">Description (optional)</Label>
              <Textarea
                id="list-description"
                placeholder="Describe this list..."
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateList} disabled={createList.isPending}>
              {createList.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteListId} onOpenChange={() => setDeleteListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this contact list. This action cannot be undone.
              Contacts in this list will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteList} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
