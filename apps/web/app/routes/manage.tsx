/**
 * Management Layout
 * User-global management shell (no workspace context)
 * TWEAK-005: Separated from workspace routes
 */

import { Outlet } from "react-router";
import type { Route } from "./+types/manage";
import { AppShell } from "~/components/AppShell";
import { getManagementNav } from "~/lib/navigation.tsx";
import { getTheme } from "~/lib/theme";
import { getSession } from "~/lib/auth";
import { redirect } from "react-router";

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
    theme,
    user,
  };
}

export default function ManageLayout({ loaderData }: Route.ComponentProps) {
  const { theme, user } = loaderData;

  // Build management navigation (no workspace context)
  const managementNav = getManagementNav();

  return (
    <AppShell
      theme={theme}
      brandName="ACME CORP Management"
      leftNav={managementNav}
      user={user}
      isAdmin={true}
      showSearch={false}
    >
      <Outlet />
    </AppShell>
  );
}
