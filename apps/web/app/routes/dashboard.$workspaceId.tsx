/**
 * Dashboard Layout
 * Main application shell with navigation and theme support
 * US-UI-002: Integrated with WorkspaceSelector
 * Epic 3: AI Assistant Chat Widget
 */

import { Outlet, redirect } from "react-router";
import type { Route } from "./+types/dashboard.$workspaceId";
import { AppShell } from "~/components/AppShell";
import { getDashboardNav } from "~/lib/navigation.tsx";
import { getTheme } from "~/lib/theme";
import { getSession } from "~/lib/auth";
import { WorkspaceProvider } from "~/contexts/WorkspaceContext";
import { WorkspaceSelector } from "~/components/workspace/WorkspaceSelector";
import { AIChatWidget } from "~/components/ai-assistant/AIChatWidget";

export async function loader({ request, params }: Route.LoaderArgs) {
  const theme = await getTheme(request);
  const { workspaceId } = params;

  // Get authenticated user from session
  const session = await getSession(request);
  if (!session) {
    // Preserve the original URL so we can redirect back after login
    const url = new URL(request.url);
    const redirectTo = encodeURIComponent(url.pathname + url.search);
    return redirect(`/auth/sign-in?redirect=${redirectTo}`);
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name || "User",
  };

  return {
    theme,
    user,
    workspaceId,
  };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { theme, user, workspaceId } = loaderData;

  // Minimal initial workspace — WorkspaceContext will hydrate full data from API
  const initialWorkspace = {
    id: workspaceId,
    name: "",
    role: "",
    member_count: 0,
  };

  // Build navigation with workspace context
  const dashboardNav = getDashboardNav(workspaceId);

  return (
    <WorkspaceProvider initialWorkspace={initialWorkspace} userId={user.id}>
      <AppShell
        theme={theme}
        brandName=""
        brandId={workspaceId}
        leftNav={dashboardNav}
        user={user}
        isAdmin={true}
        workspaceSelector={<WorkspaceSelector />}
      >
        <Outlet context={{ userId: user.id }} />

        <AIChatWidget workspaceId={workspaceId} userId={user.id} />
      </AppShell>
    </WorkspaceProvider>
  );
}
