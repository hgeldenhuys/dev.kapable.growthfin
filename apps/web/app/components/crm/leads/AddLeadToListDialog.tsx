/**
 * AddLeadToListDialog Component
 * Dialog for adding a lead to a contact/nurture list
 */

import { useState } from 'react';
import { Loader2, Plus, List } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useContactLists, useCreateContactList } from '~/hooks/useEnrichment';
import { toast } from 'sonner';

interface AddLeadToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  workspaceId: string;
}

export function AddLeadToListDialog({
  open,
  onOpenChange,
  leadId,
  workspaceId,
}: AddLeadToListDialogProps) {
  const { data: lists = [], isLoading: isLoadingLists } = useContactLists(workspaceId);
  const createList = useCreateContactList();

  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const activeLists = lists.filter((list) => list.status === 'active');

  const handleReset = () => {
    setMode('select');
    setSelectedListId('');
    setNewListName('');
    setNewListDescription('');
    setIsAdding(false);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleAddToList = async () => {
    if (!selectedListId && mode === 'select') {
      toast.error('No list selected', { description: 'Please select a list to add this lead to' });
      return;
    }

    if (!newListName.trim() && mode === 'create') {
      toast.error('List name required', { description: 'Please enter a name for the new list' });
      return;
    }

    setIsAdding(true);

    try {
      let listId = selectedListId;

      // Create new list if in create mode
      if (mode === 'create') {
        const newList = await createList.mutateAsync({
          workspaceId,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          type: 'manual',
        });
        listId = newList.id;
      }

      // Add lead to the list
      const response = await fetch(
        `/api/v1/crm/lists/${listId}/contacts?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactIds: [leadId],
            source: 'manual',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to add lead to list');
      }

      toast.success('Lead added to list', { description: 'Successfully added lead to the list.' });

      handleClose();
    } catch (error) {
      console.error('Failed to add lead to list:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to add lead to list' });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
          <DialogDescription>
            Add this lead to a nurture or contact list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'select' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('select')}
              disabled={isAdding}
              className="flex-1"
            >
              <List className="mr-2 h-4 w-4" />
              Select List
            </Button>
            <Button
              variant={mode === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('create')}
              disabled={isAdding}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </div>

          {/* Select Existing List */}
          {mode === 'select' && (
            <div className="space-y-2">
              <Label htmlFor="list">Select List</Label>
              {isLoadingLists ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeLists.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <List className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No lists available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('create')}
                    disabled={isAdding}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Create your first list
                  </Button>
                </div>
              ) : (
                <Select
                  value={selectedListId}
                  onValueChange={setSelectedListId}
                  disabled={isAdding}
                >
                  <SelectTrigger id="list">
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                        {list.memberCount !== undefined && ` (${list.memberCount} members)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Create New List */}
          {mode === 'create' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">List Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Nurture Campaign Q1"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  disabled={isAdding}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="What's this list for?"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  disabled={isAdding}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToList}
            disabled={
              isAdding ||
              (mode === 'select' && !selectedListId) ||
              (mode === 'create' && !newListName.trim())
            }
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add to List
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
