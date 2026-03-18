/**
 * CreateListDialog Component
 * Dialog for creating a new contact list
 */

import { useState, useMemo } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
import { useCreateContactList, useContactLists } from '~/hooks/useEnrichment';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function CreateListDialog({ open, onOpenChange, workspaceId }: CreateListDialogProps) {
  const createList = useCreateContactList();
  const { data: existingLists = [] } = useContactLists(workspaceId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('manual');

  // Check for duplicate list name (case-insensitive)
  const isDuplicate = useMemo(() => {
    if (!name.trim()) return false;
    return existingLists.some(
      (list) => list.name.toLowerCase() === name.trim().toLowerCase()
    );
  }, [name, existingLists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Error', { description: 'Please enter a list name' });
      return;
    }

    if (isDuplicate) {
      toast.error('Error', { description: 'A list with this name already exists in this workspace' });
      return;
    }

    try {
      await createList.mutateAsync({
        workspaceId,
        name: name.trim(),
        ...(description.trim() && { description: description.trim() }),
        type: type as 'manual' | 'import' | 'campaign' | 'enrichment' | 'segment',
      });

      toast.success('List created', { description: 'Contact list has been created successfully' });

      // Reset form
      setName('');
      setDescription('');
      setType('manual');
      onOpenChange(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setType('manual');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Contact List</DialogTitle>
            <DialogDescription>
              Create a new list to organize your contacts for enrichment and campaigns.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">List Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Q1 Prospects"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={isDuplicate ? 'border-destructive' : ''}
                required
              />
              {isDuplicate && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  A list with this name already exists in this workspace
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of this list..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="enrichment">Enrichment</SelectItem>
                  <SelectItem value="segment">Segment</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The type helps organize lists by their source or purpose
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createList.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createList.isPending || isDuplicate}>
              {createList.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create List
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
