/**
 * Lead Lists Index Page
 * View and manage all lead lists with filtering and navigation
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Target, Calendar, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
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
import { useContactLists, useDeleteContactList } from '~/hooks/useEnrichment';
import { toast } from 'sonner';
import { CreateLeadListDialog } from '~/components/crm/lists/CreateLeadListDialog';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function LeadListsIndexPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: lists = [], isLoading } = useContactLists(workspaceId, 'lead');
  const deleteList = useDeleteContactList();

  const handleViewList = (listId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/lists/${listId}`);
  };

  const handleDeleteList = async () => {
    if (!deleteListId) return;

    try {
      await deleteList.mutateAsync({
        listId: deleteListId,
        workspaceId,
      });

      toast.success('List deleted', { description: 'Lead list has been deleted successfully' });

      setDeleteListId(null);
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
            <Target className="h-8 w-8 text-primary" />
            Lead Lists
          </h1>
          <p className="text-muted-foreground">
            Organize leads into lists with custom field filters for targeted campaigns
          </p>
        </div>

        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Lead List
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lists.length}</div>
            <p className="text-xs text-muted-foreground">All lead lists</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Lists</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
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
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.length > 0
                ? Math.round(lists.reduce((acc, l) => acc + l.totalContacts, 0) / lists.length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Leads per list</p>
          </CardContent>
        </Card>
      </div>

      {/* Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Lead Lists</CardTitle>
        </CardHeader>
        <CardContent>
          {lists.length === 0 ? (
            <div className="text-center py-8">
              <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No lead lists yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first lead list to start organizing leads
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Lead List
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
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
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{list.totalContacts}</span>
                      </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteListId} onOpenChange={() => setDeleteListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this lead list. This action cannot be undone.
              Leads in this list will not be deleted.
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

      {/* Create Lead List Dialog */}
      <CreateLeadListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        workspaceId={workspaceId}
        onSuccess={(listId) => {
          setShowCreateDialog(false);
          navigate(`/dashboard/${workspaceId}/crm/leads/lists/${listId}`);
        }}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
