/**
 * Workspace Selector Component
 *
 * US-UI-002: Dropdown to switch between workspaces
 * Shows current workspace and allows switching with navigation
 */

import { useNavigate, useLocation } from "react-router";
import { ChevronDown, Check } from "lucide-react";
import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { getContrastColor } from "../../lib/workspace-colors";

// UUID pattern to detect entity IDs in paths
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract the feature path from current location, stripping entity-specific segments.
 *
 * Examples:
 * - /dashboard/ws1/crm/sms-templates → /crm/sms-templates
 * - /dashboard/ws1/crm/contacts/uuid-here → /crm/contacts (strips UUID)
 * - /dashboard/ws1/crm/leads/uuid/edit → /crm/leads (strips UUID and action)
 * - /dashboard/ws1/settings → /settings
 */
function extractFeaturePath(pathname: string, currentWorkspaceId: string): string {
  // Remove the /dashboard/{workspaceId} prefix
  const prefix = `/dashboard/${currentWorkspaceId}`;
  if (!pathname.startsWith(prefix)) {
    return ""; // Fallback to root
  }

  const pathAfterWorkspace = pathname.slice(prefix.length);
  if (!pathAfterWorkspace || pathAfterWorkspace === "/") {
    return ""; // Already at workspace root
  }

  // Split path and filter out entity-specific segments
  const segments = pathAfterWorkspace.split("/").filter(Boolean);
  const featureSegments: string[] = [];

  for (const segment of segments) {
    // Stop at UUID (entity ID) or action segments that follow entity IDs
    if (UUID_PATTERN.test(segment)) {
      break;
    }
    // Also stop at 'new' if it's an entity creation route
    if (segment === "new" && featureSegments.length > 0) {
      break;
    }
    featureSegments.push(segment);
  }

  return featureSegments.length > 0 ? "/" + featureSegments.join("/") : "";
}

export function WorkspaceSelector() {
  const { currentWorkspace, workspaces, switchWorkspace, isLoading } = useWorkspaceContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleWorkspaceSelect = (workspaceId: string) => {
    switchWorkspace(workspaceId);

    // Preserve feature path when switching workspaces
    const featurePath = currentWorkspace
      ? extractFeaturePath(location.pathname, currentWorkspace.id)
      : "";

    navigate(`/dashboard/${workspaceId}${featurePath}`);
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-full justify-between">
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  if (!currentWorkspace) {
    return (
      <Button variant="outline" disabled className="w-full justify-between">
        <span className="text-sm">No workspace</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {/* Icon-only view (collapsed) */}
          <div
            className={cn(
              "hidden group-data-[collapsible=icon]:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              !currentWorkspace.settings?.accentColor && "bg-primary text-primary-foreground"
            )}
            style={currentWorkspace.settings?.accentColor
              ? { backgroundColor: currentWorkspace.settings.accentColor, color: getContrastColor(currentWorkspace.settings.accentColor) }
              : undefined}
          >
            <span className={cn("font-bold", currentWorkspace.settings?.emoji ? "text-base" : "text-sm")}>
              {currentWorkspace.settings?.emoji || currentWorkspace.name?.[0]?.toUpperCase() || "W"}
            </span>
          </div>

          {/* Full view (expanded) */}
          <div className="flex flex-row items-center gap-2 overflow-hidden flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            {currentWorkspace.settings?.accentColor && (
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: currentWorkspace.settings.accentColor }}
              />
            )}
            <span className="text-sm font-semibold truncate">
              {currentWorkspace.settings?.emoji ? `${currentWorkspace.settings.emoji} ${currentWorkspace.name}` : currentWorkspace.name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {currentWorkspace.role}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 group-data-[collapsible=icon]:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {workspaces.map((workspace) => {
          const isSelected = workspace.id === currentWorkspace?.id;
          return (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => handleWorkspaceSelect(workspace.id)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                isSelected && "bg-accent"
              )}
            >
              <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {workspace.settings?.accentColor && (
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: workspace.settings.accentColor }}
                    />
                  )}
                  <span className="font-medium truncate">
                    {workspace.settings?.emoji ? `${workspace.settings.emoji} ${workspace.name}` : workspace.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {workspace.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {workspace.member_count} members
                  </span>
                </div>
              </div>
              {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
