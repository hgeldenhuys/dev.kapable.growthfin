/**
 * Direct DB handler for /api/v1/workspaces
 *
 * Bypasses the platform API proxy — queries workspace_members + workspaces
 * directly from the shared database. This avoids the BetterAuth session
 * validation issue on the platform API (port 3003).
 */

import type { Route } from "./+types/api.v1.workspaces";
import { db, workspaces, workspaceMembers, eq, and } from "~/lib/db.server";
import { getSession } from "~/lib/auth";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  // Validate auth
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use session userId if not provided (security: don't let users query other users' workspaces)
  const targetUserId = userId || session.user.id;
  if (targetUserId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Query workspace memberships with workspace details
    const memberships = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
        workspaceSettings: workspaces.settings,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.userId, targetUserId),
          eq(workspaceMembers.status, "active")
        )
      );

    // Get member counts per workspace
    const workspaceList = [];
    for (let i = 0; i < memberships.length; i++) {
      const m = memberships[i];
      if (!m) continue;

      // Count members in this workspace
      const memberRows = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, m.workspaceId),
            eq(workspaceMembers.status, "active")
          )
        );

      workspaceList.push({
        id: m.workspaceId,
        name: m.workspaceName,
        slug: m.workspaceSlug,
        role: m.role,
        member_count: memberRows.length,
        settings: m.workspaceSettings || {},
      });
    }

    return Response.json({ workspaces: workspaceList });
  } catch (error) {
    console.error("[workspaces] Failed to fetch workspaces:", error);
    return Response.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}
