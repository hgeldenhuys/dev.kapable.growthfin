/**
 * Workspace Settings Page
 * US-UI-004: Settings page for workspace configuration
 *
 * Features:
 * - 5 grouped tabs: General, Members, Channels, Developer, Audit & Compliance
 * - Permission-gated (owner/admin only for settings)
 * - Workspace name editing (owner only)
 * - Danger zone for workspace deletion (owner only)
 * - Member management
 */

import type { Route } from "./+types/dashboard.$workspaceId.settings._index";
import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { GeneralSettingsTab } from "~/components/workspace/settings/GeneralSettingsTab";
import { MembersTab } from "~/components/workspace/settings/MembersTab";
import { ChannelsSettingsTab } from "~/components/workspace/settings/ChannelsSettingsTab";
import { DeveloperSettingsTab } from "~/components/workspace/settings/DeveloperSettingsTab";
import { AuditComplianceTab } from "~/components/workspace/settings/AuditComplianceTab";

export async function loader({ params, request }: Route.LoaderArgs) {
  const { db, workspaces, users, eq, sql } = await import('~/lib/db.server');
  const { workspaceMembers } = await import('@agios/db');
  const { getSession } = await import('~/lib/auth');
  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  // Get user from Better Auth session
  const session = await getSession(request);
  const userId = session?.user?.id;
  if (!userId) {
    throw new Response('Authentication required', { status: 401 });
  }

  const [workspace, members] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1).then(r => r[0]),
    db.select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      invitedBy: workspaceMembers.invitedBy,
      invitedAt: workspaceMembers.invitedAt,
      joinedAt: sql`COALESCE(${workspaceMembers.joinedAt}, ${workspaceMembers.createdAt})`.as('joinedAt'),
      createdAt: workspaceMembers.createdAt,
      updatedAt: workspaceMembers.updatedAt,
      name: users.name,
      email: users.email,
    })
      .from(workspaceMembers)
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
  ]);

  if (!workspace) {
    throw new Response('Workspace not found', { status: 404 });
  }

  // Attach members to workspace object for component compatibility
  const workspaceWithMembers = { ...workspace, members };

  // Find current user's role (default to member for mock user)
  const currentMember = members.find((m) => m.userId === userId);
  const userRole = currentMember?.role || 'member';

  return {
    workspace: workspaceWithMembers,
    userRole,
    userId,
  };
}

export default function WorkspaceSettingsPage({
  loaderData,
}: Route.ComponentProps) {
  const { workspace, userRole, userId } = loaderData;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <p className="text-muted-foreground">
            Manage workspace configuration and members
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">
            Members ({workspace.members.length})
          </TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="developer">Developer</TabsTrigger>
          <TabsTrigger value="audit">Audit & Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <GeneralSettingsTab
            workspace={workspace}
            userRole={userRole}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <MembersTab
            workspace={workspace}
            userRole={userRole}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <ChannelsSettingsTab
            workspaceId={workspace.id}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="developer" className="space-y-4">
          <DeveloperSettingsTab workspaceId={workspace.id} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditComplianceTab workspaceId={workspace.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
