/**
 * Waiting for Invitation Screen
 *
 * US-UI-003: Displayed when user has no workspaces
 * Friendly screen explaining invitation process
 * Updated: Added Create Workspace button for MVP
 */

import { useState } from "react";
import { Mail, HelpCircle, Plus } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Toaster } from "../ui/sonner";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

interface WaitingForInvitationScreenProps {
  userId?: string;
  onWorkspaceCreated?: () => void;
}

export function WaitingForInvitationScreen({
  userId = "", // Must be provided by caller
  onWorkspaceCreated,
}: WaitingForInvitationScreenProps = {}) {
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="max-w-md p-8 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Waiting for an Invitation</h2>
          <p className="text-muted-foreground">
            You don't have access to any workspaces yet.
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            To get started, ask a team member to invite you to their workspace.
          </p>
          <p className="text-muted-foreground font-medium">
            Check your email for invitation links!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          <Button
            className="w-full"
            onClick={() => setCreateWorkspaceOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Workspace
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              // TODO: Link to help documentation
              window.open("/help/invitations", "_blank");
            }}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Need Help?
          </Button>
        </div>
      </Card>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        userId={userId}
        onWorkspaceCreated={onWorkspaceCreated}
      />

      {/* Toaster for error messages (not inside AppShell on this page) */}
      <Toaster position="top-right" closeButton richColors expand={false} />
    </div>
  );
}
