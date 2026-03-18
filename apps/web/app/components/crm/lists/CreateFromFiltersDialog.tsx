/**
 * CreateFromFiltersDialog Component
 * Dialog for creating a new list from active custom field filters
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '~/components/ui/textarea';
import { toast } from 'sonner';
import type { CustomFieldFilters } from './DynamicListFilters';

interface CreateFromFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceListId: string;
  sourceListName: string;
  filters: CustomFieldFilters;
  estimatedCount: number;
  workspaceId: string;
  userId: string;
}

export function CreateFromFiltersDialog({
  open,
  onOpenChange,
  sourceListId,
  sourceListName,
  filters,
  estimatedCount,
  workspaceId,
  userId,
}: CreateFromFiltersDialogProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState(`${sourceListName} - Filtered`);
  const [description, setDescription] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Validation Error', { description: 'List name is required' });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(
        `/api/v1/crm/lists/operations/create-from-filters?workspaceId=${workspaceId}&userId=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceListId,
            name: name.trim(),
            description: description.trim() || undefined,
            filters,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        toast.error('Error', { description: errorData?.message || 'Failed to create list from filters' });
        setIsCreating(false);
        return;
      }

      const result = await response.json();

      toast.success('Success', { description: `List '${name}' created with ${result.list.memberCount || estimatedCount} members` });

      // Navigate to new list
      navigate(`/dashboard/${workspaceId}/crm/lists/${result.list.id}`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to create list from filters' });
      setIsCreating(false);
    }
  };

  // Format filter values for display
  const formatFilterValue = (value: any): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  // Get active filters (exclude null, undefined, 'all', empty strings)
  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value !== null && value !== 'all' && value !== undefined && value !== ''
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create List from Filters</DialogTitle>
          <DialogDescription>
            Create a new list containing only the filtered members from "{sourceListName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">List Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter list name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter list description"
              rows={3}
            />
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Active Filters:</p>
              <ul className="space-y-1">
                {activeFilters.map(([key, value]) => (
                  <li key={key} className="text-sm">
                    <span className="font-medium">{key}:</span>{' '}
                    <span className="text-muted-foreground">{formatFilterValue(value)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-sm">
                <span className="font-medium">Estimated members:</span>{' '}
                <span className="text-muted-foreground">~{estimatedCount}</span>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
