/**
 * Create Workspace Modal
 *
 * US-WM-001: Create New Workspace
 * Form with workspace name and auto-generated slug
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { toast } from 'sonner';

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onWorkspaceCreated?: () => void;
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
  userId,
  onWorkspaceCreated,
}: CreateWorkspaceModalProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      const autoSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      setSlug(autoSlug);
    }
  }, [name, slugManuallyEdited]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setSlugManuallyEdited(false);
      setCreating(false);
    }
  }, [open]);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    // Only allow lowercase alphanumeric and hyphens
    const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleanSlug);
  };

  const handleCreate = async () => {
    // Validation
    if (!name || name.length < 1 || name.length > 100) {
      toast.error('Invalid name', { description: 'Workspace name must be between 1 and 100 characters' });
      return;
    }

    if (!slug || slug.length < 3 || slug.length > 50) {
      toast.error('Invalid slug', { description: 'URL slug must be between 3 and 50 characters' });
      return;
    }

    setCreating(true);

    try {
      const response = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          ownerId: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create workspace');
      }

      const result = await response.json();

      // Backend returns workspace directly, not nested under .workspace
      const workspaceId = result.id || result.workspace?.id;

      toast.success('Workspace created', { description: `${name} has been created successfully` });

      // Call callback if provided
      onWorkspaceCreated?.();

      // Close modal
      onOpenChange(false);

      // Navigate to new workspace
      navigate(`/dashboard/${workspaceId}`);
    } catch (error) {
      toast.error('Failed to create workspace', { description: String(error) });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Create New Workspace
          </DialogTitle>
          <DialogDescription>
            Create a new workspace to organize your work and collaborate with your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="workspace-name">
              Workspace Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="workspace-name"
              name="workspace-name"
              placeholder="Marketing Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={creating}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/100 characters
            </p>
          </div>

          {/* URL Slug */}
          <div className="space-y-2">
            <Label htmlFor="workspace-slug">
              URL Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="workspace-slug"
              name="workspace-slug"
              placeholder="marketing-team"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              maxLength={50}
              disabled={creating}
            />
            <p className="text-xs text-muted-foreground">
              {slug ? `newleads.co.za/${slug}` : 'Lowercase letters, numbers, and hyphens only'}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !name || !slug}
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Workspace'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
