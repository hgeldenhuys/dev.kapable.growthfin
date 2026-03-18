/**
 * Delete Workspace Dialog
 * Confirmation dialog that requires typing workspace name to delete
 * Only allowed when workspace has no other active members
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
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: { id: string; name: string };
  userId: string;
  onSuccess?: () => void;
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  userId,
  onSuccess,
}: DeleteWorkspaceDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const nameMatches = confirmName === workspace.name;

  async function handleDelete() {
    if (!nameMatches) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}?requestingUserId=${userId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete workspace");
      }

      toast.success(`Workspace "${workspace.name}" deleted`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete workspace"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Workspace
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone. All data in this
            workspace will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              You are about to delete &quot;{workspace.name}&quot;
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently remove all leads, contacts, campaigns,
              templates, and settings associated with this workspace.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-mono font-bold">{workspace.name}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={workspace.name}
              disabled={isDeleting}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || !nameMatches}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Workspace
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
