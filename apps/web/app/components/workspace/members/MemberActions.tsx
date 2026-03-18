/**
 * Member Actions Component
 * Dropdown menu for member management actions
 *
 * Features:
 * - Change role (admin+, can't change own role)
 * - Remove member (admin+ for members, owner for admins)
 * - Permission checks
 * - Confirmation dialogs
 */

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { MoreHorizontal, Shield, Trash2 } from "lucide-react";

interface MemberActionsProps {
  member: any;
  currentUserId: string;
  currentUserRole: string;
  onChangeRole: (memberId: string, newRole: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}

export function MemberActions({
  member,
  currentUserId,
  currentUserRole,
  onChangeRole,
  onRemove,
}: MemberActionsProps) {
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [isProcessing, setIsProcessing] = useState(false);

  const isOwnAccount = member.userId === currentUserId;
  const isMemberOwner = member.role === "owner";
  const isMemberAdmin = member.role === "admin";
  const isCurrentUserOwner = currentUserRole === "owner";
  const isCurrentUserAdmin = currentUserRole === "admin";

  // Permission checks
  const canChangeRole =
    !isOwnAccount &&
    !isMemberOwner &&
    (isCurrentUserOwner || (isCurrentUserAdmin && !isMemberAdmin));

  const canRemove =
    !isOwnAccount &&
    !isMemberOwner &&
    (isCurrentUserOwner || (isCurrentUserAdmin && !isMemberAdmin));

  // If no actions available, don't show menu
  if (!canChangeRole && !canRemove) {
    return null;
  }

  async function handleChangeRole() {
    if (selectedRole === member.role) {
      setShowRoleDialog(false);
      return;
    }

    setIsProcessing(true);
    try {
      await onChangeRole(member.userId, selectedRole);
      setShowRoleDialog(false);
    } catch (error) {
      // Error already handled by parent
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRemove() {
    setIsProcessing(true);
    try {
      await onRemove(member.userId);
      setShowRemoveDialog(false);
    } catch (error) {
      // Error already handled by parent
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canChangeRole && (
            <DropdownMenuItem onClick={() => setShowRoleDialog(true)}>
              <Shield className="mr-2 h-4 w-4" />
              Change Role
            </DropdownMenuItem>
          )}
          {canRemove && (
            <DropdownMenuItem
              onClick={() => setShowRemoveDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Member
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Update the role for {member.name || member.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-select">New Role</Label>
              <Select
                value={selectedRole}
                onValueChange={setSelectedRole}
                disabled={isProcessing}
              >
                <SelectTrigger id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Role Permissions:</p>
              {selectedRole === "admin" && (
                <p className="text-muted-foreground">
                  Can manage members, settings, and all workspace resources
                </p>
              )}
              {selectedRole === "member" && (
                <p className="text-muted-foreground">
                  Can create and edit workspace resources
                </p>
              )}
              {selectedRole === "viewer" && (
                <p className="text-muted-foreground">
                  Can view workspace resources but not edit
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRoleDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={isProcessing}>
              {isProcessing ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{member.name || member.email}</strong> from this workspace?
              This action cannot be undone. They will lose access to all workspace
              resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
