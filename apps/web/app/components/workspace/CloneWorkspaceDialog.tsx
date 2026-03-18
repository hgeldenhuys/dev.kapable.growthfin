/**
 * Clone Workspace Dialog
 * Allows workspace owners to duplicate a workspace's configuration
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

interface CloneWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: { id: string; name: string };
  userId: string;
  onSuccess?: () => void;
}

export function CloneWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  userId,
  onSuccess,
}: CloneWorkspaceDialogProps) {
  const [name, setName] = useState(`${workspace.name} (Copy)`);
  const [isCloning, setIsCloning] = useState(false);

  async function handleClone() {
    if (!name.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }

    setIsCloning(true);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspace.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ownerId: userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clone workspace");
      }

      toast.success(`Workspace "${name.trim()}" created successfully`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to clone workspace:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to clone workspace"
      );
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Workspace
          </DialogTitle>
          <DialogDescription>
            Create a copy of &quot;{workspace.name}&quot; with all its settings,
            templates, and configuration. No leads, contacts, or campaign data
            will be copied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">New Workspace Name</Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter workspace name"
              disabled={isCloning}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCloning}
          >
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={isCloning || !name.trim()}>
            {isCloning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Clone Workspace
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
