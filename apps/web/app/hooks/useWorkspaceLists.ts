/**
 * useWorkspaceLists Hook
 * Fetch all contact lists for a workspace
 */

import { useQuery } from '@tanstack/react-query';
import type { ContactList } from '~/types/crm';

interface UseWorkspaceListsOptions {
  entityType?: 'contact' | 'lead' | 'account';
  type?: 'segment' | 'manual' | 'import';
  enabled?: boolean;
}

export function useWorkspaceLists(
  workspaceId: string,
  options?: UseWorkspaceListsOptions
) {
  const { entityType, type, enabled = true } = options || {};

  return useQuery({
    queryKey: ['crm', 'lists', 'workspace', workspaceId, { entityType, type }],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        ...(entityType && { entityType }),
        ...(type && { type }),
      });

      const response = await fetch(`/api/v1/crm/lists?${params}`);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch lists');
      }

      const data = await response.json();
      // API returns {lists: [...], total: number}
      return (data.lists || []) as ContactList[];
    },
    enabled: enabled && !!workspaceId,
  });
}
