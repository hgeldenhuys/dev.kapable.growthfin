/**
 * General Settings Tab
 * US-UI-004: General workspace configuration
 *
 * Features:
 * - Workspace name (editable for owner)
 * - Workspace slug (readonly)
 * - Created date
 * - Metadata display
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import { toast } from "sonner";
import { Pencil, Save, X, AlertTriangle, Trash2, Palette } from "lucide-react";
import { DeleteWorkspaceDialog } from "../DeleteWorkspaceDialog";
import { COLOR_PRESETS } from "../../../lib/workspace-colors";
import { cn } from "../../../lib/utils";

interface GeneralSettingsTabProps {
  workspace: any;
  userRole: string;
  userId: string;
}

export function GeneralSettingsTab({
  workspace,
  userRole,
  userId,
}: GeneralSettingsTabProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [platformName, setPlatformName] = useState(workspace.settings?.platformName || '');
  const [isEditingPlatformName, setIsEditingPlatformName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(workspace.settings?.accentColor || null);
  const [emoji, setEmoji] = useState(workspace.settings?.emoji || '');
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  const canEdit = userRole === "owner" || userRole === "admin";
  const activeMemberCount = workspace.members?.length || 0;
  const canDelete = canEdit && activeMemberCount <= 1;

  async function handleSave() {
    if (!workspaceName.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      // Client-side uses proxy routes

      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: workspaceName,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update workspace");
      }

      toast.success("Workspace name updated successfully");
      setIsEditing(false);
      // Reload page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error("Failed to update workspace:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace"
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setWorkspaceName(workspace.name);
    setIsEditing(false);
  }

  async function handleSavePlatformName() {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            settings: {
              ...workspace.settings,
              platformName: platformName.trim() || undefined,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update platform name");
      }

      toast.success("Platform name updated successfully");
      setIsEditingPlatformName(false);
    } catch (error) {
      console.error("Failed to update platform name:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update platform name"
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelPlatformName() {
    setPlatformName(workspace.settings?.platformName || '');
    setIsEditingPlatformName(false);
  }

  async function handleSaveAppearance() {
    setIsSavingAppearance(true);
    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspace.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: {
              ...workspace.settings,
              accentColor: accentColor || undefined,
              emoji: emoji.trim() || undefined,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update appearance");
      }

      toast.success("Workspace appearance updated");
      window.location.reload();
    } catch (error) {
      console.error("Failed to update appearance:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update appearance"
      );
    } finally {
      setIsSavingAppearance(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>General Information</CardTitle>
        <CardDescription>
          Basic workspace configuration and metadata
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Workspace Name */}
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace Name</Label>
          <div className="flex gap-2">
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              disabled={!isEditing || isSaving}
              placeholder="Enter workspace name"
            />
            {canEdit && !isEditing && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Only workspace owners can edit the name
            </p>
          )}
        </div>

        {/* Platform Name */}
        <div className="space-y-2">
          <Label htmlFor="platform-name">Platform Name</Label>
          <div className="flex gap-2">
            <Input
              id="platform-name"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              disabled={!isEditingPlatformName || isSaving}
              placeholder="NewLeads"
            />
            {canEdit && !isEditingPlatformName && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditingPlatformName(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isEditingPlatformName && (
              <>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleSavePlatformName}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCancelPlatformName}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This name appears throughout the app and in emails. Defaults to &quot;NewLeads&quot; if empty.
          </p>
        </div>

        {/* Workspace Slug */}
        <div className="space-y-2">
          <Label htmlFor="workspace-slug">Workspace Slug</Label>
          <Input
            id="workspace-slug"
            value={workspace.slug}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            The workspace slug is used in URLs and cannot be changed
          </p>
        </div>

        {/* Workspace ID */}
        <div className="space-y-2">
          <Label htmlFor="workspace-id">Workspace ID</Label>
          <Input
            id="workspace-id"
            value={workspace.id}
            disabled
            className="bg-muted font-mono text-xs"
          />
        </div>

        {/* Created Date */}
        <div className="space-y-2">
          <Label>Created</Label>
          <p className="text-sm">{formatDate(workspace.createdAt)}</p>
        </div>

        {/* Member Count */}
        <div className="space-y-2">
          <Label>Members</Label>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{workspace.members.length}</Badge>
            <span className="text-sm text-muted-foreground">
              active members
            </span>
          </div>
        </div>

        {/* Current User Role */}
        <div className="space-y-2">
          <Label>Your Role</Label>
          <Badge variant="default">{userRole}</Badge>
        </div>
      </CardContent>
    </Card>

    {/* Workspace Appearance */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Workspace Appearance
        </CardTitle>
        <CardDescription>
          Visual indicators to distinguish this workspace at a glance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Accent Color */}
        <div className="space-y-3">
          <Label>Accent Color</Label>
          <div className="flex flex-wrap gap-2">
            {/* None / Clear option */}
            <button
              type="button"
              onClick={() => canEdit && setAccentColor(null)}
              disabled={!canEdit}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-all flex items-center justify-center text-xs text-muted-foreground",
                accentColor === null
                  ? "border-foreground ring-2 ring-foreground/20"
                  : "border-border hover:border-foreground/50"
              )}
              title="None"
            >
              <X className="h-3 w-3" />
            </button>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => canEdit && setAccentColor(preset.value)}
                disabled={!canEdit}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-all",
                  accentColor === preset.value
                    ? "border-foreground ring-2 ring-foreground/20 scale-110"
                    : "border-transparent hover:scale-110"
                )}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
          {accentColor && (
            <div className="flex items-center gap-2">
              <div
                className="h-5 w-5 rounded"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                {accentColor}
              </span>
            </div>
          )}
        </div>

        {/* Emoji */}
        <div className="space-y-2">
          <Label htmlFor="workspace-emoji">Emoji</Label>
          <div className="flex items-center gap-3">
            <Input
              id="workspace-emoji"
              value={emoji}
              onChange={(e) => {
                // Take only the last grapheme cluster (supports multi-codepoint emoji)
                const val = e.target.value;
                if (!val) { setEmoji(''); return; }
                const segmenter = new (Intl as any).Segmenter();
                const segments = [...segmenter.segment(val)] as Array<{ segment: string }>;
                const last = segments[segments.length - 1];
                setEmoji(last ? last.segment : '');
              }}
              disabled={!canEdit}
              placeholder="e.g. 🚀"
              className="w-20 text-center text-lg"
              maxLength={4}
            />
            {emoji && (
              <span className="text-2xl">{emoji}</span>
            )}
            {emoji && canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEmoji('')}
              >
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Shown in the sidebar avatar and workspace switcher
          </p>
        </div>

        {/* Save button */}
        {canEdit && (
          <Button
            onClick={handleSaveAppearance}
            disabled={isSavingAppearance}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSavingAppearance ? "Saving..." : "Save Appearance"}
          </Button>
        )}
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only workspace owners can change appearance settings
          </p>
        )}
      </CardContent>
    </Card>

    {/* Danger Zone - Owner Only */}
    {canEdit && (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that permanently affect this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete this workspace</p>
              <p className="text-sm text-muted-foreground">
                {canDelete
                  ? "Permanently delete this workspace and all its data"
                  : `Remove all other members before deleting (${activeMemberCount} active)`}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={!canDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Delete Dialog */}
    <DeleteWorkspaceDialog
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      workspace={workspace}
      userId={userId}
      onSuccess={() => navigate("/dashboard")}
    />
    </>
  );
}
