/**
 * Dashboard Root - Workspace List with Shell
 *
 * US-UI-001: Landing page showing all workspaces user can access
 * US-UI-003: Shows "waiting for invitation" if no workspaces
 * TWEAK-002: Added shell with workspace navigation in sidebar
 * FIX-WORKSPACE-CONSISTENCY: Wrapped with WorkspaceProvider for consistent data with rest of app
 */

import type { Route } from "./+types/dashboard._index";
import { useEffect, useState } from "react";
import { WorkspaceCard } from "~/components/workspace/WorkspaceCard";
import { WaitingForInvitationScreen } from "~/components/workspace/WaitingForInvitation";
import { AppShell } from "~/components/AppShell";
import { getDashboardRootNav } from "~/lib/navigation";
import { getTheme } from "~/lib/theme";
import { getSession } from "~/lib/auth";
import { redirect } from "react-router";
import { WorkspaceProvider, useWorkspaceContext } from "~/contexts/WorkspaceContext";

export async function loader({ request }: Route.LoaderArgs) {
  const theme = await getTheme(request);

  // Get authenticated user from session
  const session = await getSession(request);

  // Redirect to sign-in if not authenticated
  if (!session) {
    return redirect("/auth/sign-in");
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name || "User",
  };

  return {
    user,
    theme,
  };
}

function WorkspaceListContent({ user, theme }: { user: any; theme: string }) {
  const { workspaces, isLoading } = useWorkspaceContext();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading workspaces...</div>;
  }

  // Show waiting screen if no workspaces (no shell needed for empty state)
  if (workspaces.length === 0) {
    return <WaitingForInvitationScreen userId={user.id} />;
  }

  // Build navigation with workspace list
  const navigation = getDashboardRootNav(workspaces);

  // Show workspace list with shell
  return (
    <AppShell
      theme={theme}
      brandName=""
      pageTitle="Workspaces"
      leftNav={navigation}
      user={user}
      showSearch={false}
    >
      <div className="container mx-auto p-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Your Workspaces</h1>
            <p className="text-muted-foreground mt-2">
              Select a workspace to get started
            </p>
          </div>

          {/* Workspace Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function WorkspaceListPage({ loaderData }: Route.ComponentProps) {
  const { user, theme } = loaderData;

  return (
    <WorkspaceProvider userId={user.id}>
      <WorkspaceListContent user={user} theme={theme} />
    </WorkspaceProvider>
  );
}
