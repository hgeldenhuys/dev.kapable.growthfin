/**
 * usePermissions Hook
 * US-UI-008: Role-Based UI Controls
 *
 * Provides permission checking based on workspace role hierarchy:
 * - viewer (0): Read-only access
 * - member (1): Create/edit own items
 * - admin (2): Manage all, invite members
 * - owner (3): Full control including workspace settings
 */

import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import type { ButtonProps } from '../components/ui/button';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../components/ui/tooltip';

export type Role = 'viewer' | 'member' | 'admin' | 'owner';

const roleHierarchy: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function usePermissions() {
  const { currentWorkspace } = useWorkspaceContext();

  const userRole = (currentWorkspace?.role || 'viewer') as Role;
  const userLevel = roleHierarchy[userRole] || 0;

  return {
    // View permissions
    canView: userLevel >= 0, // Everyone

    // Create permissions
    canCreate: userLevel >= 1, // Member+
    canCreateCampaign: userLevel >= 1,
    canCreateContact: userLevel >= 1,
    canCreateLead: userLevel >= 1,
    canCreateAccount: userLevel >= 1,
    canCreateOpportunity: userLevel >= 1,
    canCreateActivity: userLevel >= 1,

    // Edit permissions
    canEditOwn: userLevel >= 1, // Member+
    canEditAll: userLevel >= 2, // Admin+
    canEditCampaign: userLevel >= 2,
    canEditContact: userLevel >= 2,
    canEditLead: userLevel >= 2,
    canEditAccount: userLevel >= 2,
    canEditOpportunity: userLevel >= 2,

    // Delete permissions
    canDeleteOwn: userLevel >= 1, // Member+
    canDeleteAll: userLevel >= 2, // Admin+
    canDeleteCampaign: userLevel >= 2,
    canDeleteContact: userLevel >= 2,
    canDeleteLead: userLevel >= 2,
    canDeleteAccount: userLevel >= 2,
    canDeleteOpportunity: userLevel >= 2,

    // Member management
    canInviteMembers: userLevel >= 2, // Admin+
    canRemoveMembers: userLevel >= 2, // Admin+
    canChangeRoles: userLevel >= 2, // Admin+
    canManageAdmins: userLevel >= 3, // Owner only

    // Settings
    canAccessSettings: userLevel >= 2, // Admin+
    canEditWorkspace: userLevel >= 3, // Owner only
    canAccessAuditLog: userLevel >= 2, // Admin+

    // Helpers
    hasRole: (minRole: Role) => userLevel >= roleHierarchy[minRole],
    userRole,
    userLevel,
  };
}

/**
 * Permission-aware Button component
 * Shows disabled state with tooltip when user lacks permission
 */
interface PermissionButtonProps extends ButtonProps {
  requiredRole?: Role;
  requiredPermission?: boolean;
  permissionMessage?: string;
}

export function PermissionButton({
  requiredRole,
  requiredPermission,
  permissionMessage,
  children,
  disabled,
  ...props
}: PermissionButtonProps) {
  const { hasRole, userRole } = usePermissions();

  // Check role-based permission
  const hasPermission = requiredRole ? hasRole(requiredRole) : true;
  const hasCustomPermission = requiredPermission !== undefined ? requiredPermission : true;

  const isDisabled = disabled || !hasPermission || !hasCustomPermission;

  // If disabled due to permissions, show tooltip
  if (isDisabled && (requiredRole || requiredPermission !== undefined)) {
    const message = permissionMessage ||
      (requiredRole ? `Requires ${requiredRole} role or higher (you are ${userRole})` : 'You do not have permission for this action');

    return (
      <Tooltip>
        <TooltipTrigger className="inline-block">
          <Button {...props} disabled={true}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <Button {...props} disabled={disabled}>{children}</Button>;
}
