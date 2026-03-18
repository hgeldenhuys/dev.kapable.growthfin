/**
 * Members Tab
 * US-UI-005: Manage workspace members and send invitations
 *
 * Features:
 * - List current members with roles and status
 * - Invite form (email + role selection)
 * - Change role action (admin+)
 * - Remove member action (owner or admin)
 * - Shows pending invitations
 * - Permission checks
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { toast } from "sonner";
import { Mail, Send, UserPlus } from "lucide-react";
import { MemberActions } from "../members/MemberActions";

interface MembersTabProps {
  workspace: any;
  userRole: string;
  userId: string;
}

export function MembersTab({ workspace, userRole, userId }: MembersTabProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [members, setMembers] = useState(workspace.members);

  const canInvite = userRole === "owner" || userRole === "admin";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsInviting(true);
    try {
      // Client-side uses proxy routes

      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole,
            invitedBy: userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invitation");
      }

      const result = await response.json();
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
    } catch (error) {
      console.error("Failed to send invitation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation"
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      // Client-side uses proxy routes

      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}/members/${memberId}?requestingUserId=${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }

      // Update local state
      setMembers((prev: any[]) =>
        prev.map((m) =>
          m.userId === memberId ? { ...m, role: newRole } : m
        )
      );

      toast.success("Member role updated successfully");
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      // Client-side uses proxy routes

      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}/members/${memberId}?requestingUserId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      // Update local state
      setMembers((prev: any[]) => prev.filter((m) => m.userId !== memberId));

      toast.success("Member removed from workspace");
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    }
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getRoleBadgeVariant(role: string) {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  }

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Member
            </CardTitle>
            <CardDescription>
              Send an invitation to join this workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="invite-email" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isInviting}
                  required
                />
              </div>
              <div className="w-full sm:w-32">
                <Label htmlFor="invite-role" className="sr-only">
                  Role
                </Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value: any) => setInviteRole(value)}
                  disabled={isInviting}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isInviting} className="w-full sm:w-auto">
                <Send className="h-4 w-4 mr-2" />
                {isInviting ? "Sending..." : "Send Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Member List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            People who have access to this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No members found
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member: any) => (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">
                        {member.name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === "active" ? "default" : "secondary"
                          }
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(member.joinedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberActions
                          member={member}
                          currentUserId={userId}
                          currentUserRole={userRole}
                          onChangeRole={handleRoleChange}
                          onRemove={handleRemoveMember}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
