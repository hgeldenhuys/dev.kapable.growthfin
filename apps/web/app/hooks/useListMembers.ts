/**
 * useListMembers Hook
 * Fetch members of a contact list
 */

import { useQuery } from '@tanstack/react-query';
import type { Contact } from '~/types/crm';

interface UseListMembersOptions {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useListMembers(
  listId: string | null,
  workspaceId: string,
  options?: UseListMembersOptions
) {
  const { limit = 10, offset = 0, enabled = true } = options || {};

  return useQuery({
    queryKey: ['crm', 'lists', 'members', listId, workspaceId, { limit, offset }],
    queryFn: async () => {
      if (!listId) return [];

      const params = new URLSearchParams({
        workspaceId,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(
        `/api/v1/crm/lists/${listId}/members?${params}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch list members');
      }

      const data = await response.json();
      // API returns {members: [{entity: Contact}], total: number}
      // Extract the entity from each member
      const members = data.members || [];
      return members.map((m: any) => m.entity) as Contact[];
    },
    enabled: enabled && !!listId && !!workspaceId,
  });
}
