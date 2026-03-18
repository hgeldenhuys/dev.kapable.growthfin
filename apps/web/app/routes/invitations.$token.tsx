/**
 * Invitation Acceptance Page
 * US-UI-006: Public page for accepting workspace invitations
 *
 * Features:
 * - Public route (no auth required)
 * - Validates token via API
 * - Shows workspace name and role
 * - Accept button
 * - Handles expired/invalid tokens
 * - Redirects to workspace after acceptance
 */

import { redirect } from "react-router";
import type { Route } from "./+types/invitations.$token";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Mail, XCircle, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  try {
    // Validate invitation token
    const response = await fetch(
      `${apiUrl}/api/v1/workspaces/invitations/${token}`
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        error: error.error || "Invalid or expired invitation",
        token,
      };
    }

    const data = await response.json();
    return {
      invitation: data.invitation,
      token,
    };
  } catch (error) {
    console.error("Failed to validate invitation:", error);
    return {
      error: "Failed to validate invitation",
      token,
    };
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  const { token } = params;
  const formData = await request.formData();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Get user from Better Auth session
  const { getSession } = await import("~/lib/auth");
  const session = await getSession(request);
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "You must be logged in to accept an invitation" };
  }

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/workspaces/invitations/${token}/accept`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        error: error.error || "Failed to accept invitation",
      };
    }

    const result = await response.json();
    const { workspace } = result;

    // Redirect to workspace
    throw redirect(`/dashboard/${workspace.id}/crm`);
  } catch (error) {
    if (error instanceof Response) {
      throw error; // Re-throw redirect
    }
    console.error("Failed to accept invitation:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to accept invitation",
    };
  }
}

export default function InvitationAcceptancePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { invitation, error: loaderError, token } = loaderData;
  const actionError = actionData?.error;

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Error state - invalid or expired token
  if (loaderError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>{loaderError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation link may have expired or been used already.
                Please contact the workspace administrator for a new invitation.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = "/")}
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - valid invitation
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Mail className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">You've Been Invited!</CardTitle>
          <CardDescription>
            You have been invited to join a workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Workspace</p>
              <p className="font-semibold text-lg">{invitation.workspaceName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Role</p>
              <Badge variant="default" className="text-sm">
                {invitation.role}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Invited To</p>
              <p className="text-sm font-mono">{invitation.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Expires</p>
              <p className="text-sm">{formatDate(invitation.expiresAt)}</p>
            </div>
          </div>

          {/* Action Error */}
          {actionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {/* Accept Button */}
          <form method="post">
            <Button type="submit" className="w-full" size="lg">
              <CheckCircle className="mr-2 h-5 w-5" />
              Accept Invitation
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By accepting, you will become a member of this workspace
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
