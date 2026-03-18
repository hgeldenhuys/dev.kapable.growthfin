/**
 * Workspace Context Hook
 *
 * PHASE 2 IMPLEMENTATION:
 * Now uses WorkspaceContext instead of hardcoded values.
 *
 * TODO Phase 3:
 * - Context will fetch workspaces from API
 * - Add workspace switching functionality
 * - Persist selected workspace
 * - Handle workspace permissions
 */

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceContext } from "../contexts/WorkspaceContext";
import type { Workspace } from "../contexts/WorkspaceContext";

export type { Workspace };


/**
 * Get current workspace
 *
 * @returns Current workspace object with id and name
 */
export function useWorkspace() {
  const { currentWorkspace, isLoading } = useWorkspaceContext();

  return {
    data: currentWorkspace,
    isLoading,
    error: null,
  };
}

/**
 * Get current workspace ID
 *
 * @returns Current workspace ID string
 * @throws Error if workspace is not set
 */
export function useWorkspaceId(): string {
  const { currentWorkspace } = useWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("No workspace is currently set");
  }

  return currentWorkspace.id;
}

/**
 * Get current authenticated user ID
 *
 * @returns Current user ID string from the session
 */
export function useUserId(): string {
  const { userId } = useWorkspaceContext();
  return userId;
}

/**
 * Get workspace members
 *
 * @param workspaceId Workspace ID
 * @returns Query result with workspace members
 */
export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/members`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch workspace members: ${response.statusText}`);
      }
      const data = await response.json();
      return data.members || [] as Array<{
        id: string;
        name: string;
        username?: string;
        avatar?: string;
        email?: string;
      }>;
    },
    enabled: !!workspaceId,
  });
}
