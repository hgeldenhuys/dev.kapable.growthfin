/**
 * CreateLeadListDialog Component
 * Dialog for creating a new lead list with validation
 */

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { toast } from 'sonner';

interface CreateLeadListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess: (listId: string) => void;
}

export function CreateLeadListDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: CreateLeadListDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'manual' | 'import' | 'campaign' | 'enrichment' | 'segment'>('manual');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Validation Error', { description: 'List name is required' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/crm/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: name.trim(),
          description: description.trim() || null,
          type,
          entityType: 'lead',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error Creating List', { description: errorText || 'Failed to create lead list' });
        throw new Error(errorText);
      }

      const data = await response.json();

      toast.success('List created', { description: 'Lead list has been created successfully' });

      // Reset form
      setName('');
      setDescription('');
      setType('manual');

      // Call success callback with new list ID
      onSuccess(data.list.id);
    } catch (error) {
      console.error('Error creating lead list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Lead List</DialogTitle>
            <DialogDescription>
              Create a new list to organize your leads
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                List Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Enterprise Prospects, Q1 2024 Leads"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this list (optional)"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">List Type</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
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
                Select how leads will be added to this list
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create List
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
