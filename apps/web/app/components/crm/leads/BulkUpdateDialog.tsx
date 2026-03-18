/**
 * BulkUpdateDialog Component
 * Modal for bulk updating lead fields
 */

import { useState } from 'react';
import { Edit, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { useCreateBulkUpdate } from '~/hooks/useBulkOperations';
import { toast } from 'sonner';

interface BulkUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  workspaceId: string;
  userId: string;
  onSuccess?: () => void;
}

export function BulkUpdateDialog({
  open,
  onOpenChange,
  leadIds,
  workspaceId,
  userId,
  onSuccess,
}: BulkUpdateDialogProps) {
  const createBulkUpdate = useCreateBulkUpdate();

  const [fieldToUpdate, setFieldToUpdate] = useState<string>('');
  const [lifecycleStage, setLifecycleStage] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [rollbackEnabled, setRollbackEnabled] = useState(true);

  const handleSubmit = async () => {
    if (!fieldToUpdate) {
      toast.error('Validation Error', { description: 'Please select a field to update' });
      return;
    }

    // Build fields object based on selection
    const fields: Record<string, any> = {};

    if (fieldToUpdate === 'lifecycle_stage' && lifecycleStage) {
      fields.lifecycle_stage = lifecycleStage;
    } else if (fieldToUpdate === 'source' && source) {
      fields.source = source;
    } else if (fieldToUpdate === 'industry' && industry) {
      fields.industry = industry;
    } else if (fieldToUpdate === 'tags' && tags) {
      fields.tags = tags.split(',').map(t => t.trim());
    }

    if (Object.keys(fields).length === 0) {
      toast.error('Validation Error', { description: 'Please provide a value for the selected field' });
      return;
    }

    try {
      await createBulkUpdate.mutateAsync({
        workspaceId,
        leadIds,
        fields,
        userId,
        rollbackEnabled,
      });

      toast.success('Update Started', { description: `Updating ${leadIds.length} leads. You can undo this within 5 minutes.` });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Update Failed', { description: String(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Lead Fields</DialogTitle>
          <DialogDescription>
            Update fields for {leadIds.length} selected leads. Changes can be rolled back within 5 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field">Select Field to Update</Label>
            <Select value={fieldToUpdate} onValueChange={setFieldToUpdate}>
              <SelectTrigger id="field">
                <SelectValue placeholder="Choose a field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lifecycle_stage">Lifecycle Stage</SelectItem>
                <SelectItem value="source">Source</SelectItem>
                <SelectItem value="industry">Industry</SelectItem>
                <SelectItem value="tags">Tags</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fieldToUpdate === 'lifecycle_stage' && (
            <div className="space-y-2">
              <Label htmlFor="lifecycle_stage">New Lifecycle Stage</Label>
              <Select value={lifecycleStage} onValueChange={setLifecycleStage}>
                <SelectTrigger id="lifecycle_stage">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {fieldToUpdate === 'source' && (
            <div className="space-y-2">
              <Label htmlFor="source">New Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {fieldToUpdate === 'industry' && (
            <div className="space-y-2">
              <Label htmlFor="industry">New Industry</Label>
              <Input
                id="industry"
                placeholder="e.g., Technology, Finance, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                maxLength={255}
              />
            </div>
          )}

          {fieldToUpdate === 'tags' && (
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., vip, enterprise, high-priority"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum 10 tags, each up to 50 characters
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4 border-t">
            <input
              type="checkbox"
              id="rollback"
              checked={rollbackEnabled}
              onChange={(e) => setRollbackEnabled(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="rollback" className="text-sm font-normal">
              Enable rollback (can undo within 5 minutes)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBulkUpdate.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createBulkUpdate.isPending || !fieldToUpdate}
          >
            {createBulkUpdate.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Update {leadIds.length} Leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
