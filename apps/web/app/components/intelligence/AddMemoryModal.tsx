/**
 * Add Memory Modal
 * Form to create a new memory
 */

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { CreateMemoryRequest } from '../../lib/api/intelligence';

interface AddMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memory: CreateMemoryRequest) => void;
  isSubmitting: boolean;
}

export function AddMemoryModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: AddMemoryModalProps) {
  const [type, setType] = useState<CreateMemoryRequest['type']>('pattern');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSubmit({
      type,
      key: key.trim(),
      value: value.trim(),
      tags: tags.length > 0 ? tags : undefined,
    });

    // Reset form
    setKey('');
    setValue('');
    setTagsInput('');
    setType('pattern');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Memory</DialogTitle>
            <DialogDescription>
              Create a new memory for the AI to learn from
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pattern">Pattern</SelectItem>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="preference">Preference</SelectItem>
                  <SelectItem value="fact">Fact</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {type === 'pattern' &&
                  'Recurring patterns in code or behavior'}
                {type === 'decision' &&
                  'Important decisions made about the project'}
                {type === 'preference' && 'User or team preferences'}
                {type === 'fact' && 'Factual information about the project'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key">Key *</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g., 'API Error Handling Pattern'"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value *</Label>
              <Textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Describe the memory in detail..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Comma-separated tags (e.g., api, error-handling)"
              />
              <p className="text-xs text-muted-foreground">
                Optional tags to help organize memories
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
            <Button type="submit" disabled={isSubmitting || !key || !value}>
              {isSubmitting ? 'Creating...' : 'Create Memory'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
