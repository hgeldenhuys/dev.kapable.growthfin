/**
 * Edit Memory Modal
 * Form to edit an existing memory
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import type { Memory, UpdateMemoryRequest } from '../../lib/api/intelligence';

interface EditMemoryModalProps {
  memory: Memory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memoryId: string, updates: UpdateMemoryRequest) => void;
  isSubmitting: boolean;
}

export function EditMemoryModal({
  memory,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: EditMemoryModalProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (memory) {
      setKey(memory.key);
      setValue(memory.value);
      setTagsInput(memory.tags?.join(', ') || '');
    }
  }, [memory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memory) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSubmit(memory.id, {
      key: key.trim(),
      value: value.trim(),
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  if (!memory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Memory</DialogTitle>
            <DialogDescription>
              Update this {memory.type} memory
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key">Key *</Label>
              <Input
                id="edit-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-value">Value *</Label>
              <Textarea
                id="edit-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Comma-separated tags"
              />
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
            <Button type="submit" disabled={isSubmitting || !key || !value}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
