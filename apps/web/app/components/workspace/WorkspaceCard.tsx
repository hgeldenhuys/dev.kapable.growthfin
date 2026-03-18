/**
 * Workspace Card Component
 *
 * US-UI-001: Displays a workspace in the workspace list
 * Shows workspace name, role badge, member count, and owner actions (clone/delete)
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Users, Copy, Trash2, MoreVertical } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { Workspace } from "../../contexts/WorkspaceContext";
import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { CloneWorkspaceDialog } from "./CloneWorkspaceDialog";
import { DeleteWorkspaceDialog } from "./DeleteWorkspaceDialog";

interface WorkspaceCardProps {
  workspace: Workspace;
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const { userId, refetchWorkspaces } = useWorkspaceContext();
  const navigate = useNavigate();
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isOwner = workspace.role === "owner";
  const canDelete = isOwner && workspace.member_count === 1;

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow border-2 hover:border-primary/50 relative group">
        <Link to={`/dashboard/${workspace.id}/crm`} className="block">
          <div className="space-y-3">
            {/* Workspace Name */}
            <h3 className="font-semibold text-lg truncate pr-8">{workspace.name}</h3>

            {/* Role and Member Count */}
            <div className="flex items-center gap-3">
              <Badge variant={getRoleBadgeVariant(workspace.role)}>
                {workspace.role}
              </Badge>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {workspace.member_count} {workspace.member_count === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Owner Actions Menu */}
        {isOwner && (
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setShowCloneDialog(true);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Clone Workspace
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Workspace
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </Card>

      {/* Clone Dialog */}
      <CloneWorkspaceDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        workspace={workspace}
        userId={userId}
        onSuccess={() => refetchWorkspaces()}
      />

      {/* Delete Dialog */}
      {canDelete && (
        <DeleteWorkspaceDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          workspace={workspace}
          userId={userId}
          onSuccess={() => {
            refetchWorkspaces();
            navigate("/dashboard");
          }}
        />
      )}
    </>
  );
}
