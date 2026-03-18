/**
 * Claude Observability Shell
 * Simplified layout for Claude-specific observability features
 * No workspace context - pure event/session/agent tracking
 */

import { Outlet, redirect } from "react-router";
import type { Route } from "./+types/claude";
import { AppShell } from "../components/AppShell";
import { ClaudeProjectSelector } from "../components/ClaudeProjectSelector";
import { claudeNav } from "../lib/navigation";
import { getTheme } from "../lib/theme";
import { getSession } from "../lib/auth";

export async function loader({ request }: Route.LoaderArgs) {
  const theme = await getTheme(request);
  const url = new URL(request.url);

  // SDLC and Context routes don't require authentication - they're read-only internal dev tools
  if (url.pathname.startsWith('/claude/sdlc') || url.pathname.startsWith('/claude/context')) {
    return {
      theme,
      user: null,
    };
  }

  // Get authenticated user from session for other /claude routes
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
    theme,
    user,
  };
}

export default function ClaudeLayout({ loaderData }: Route.ComponentProps) {
  const { theme, user } = loaderData;

  return (
    <AppShell
      theme={theme}
      brandName="Claude Observability"
      leftNav={claudeNav}
      user={user}
      isAdmin={true}
      showSearch={false}
      centerContent={false}
      workspaceSelector={<ClaudeProjectSelector />}
    >
      <Outlet />
    </AppShell>
  );
}
