/**
 * useList Hook
 * Fetch a single list by ID
 */

import { useQuery } from '@tanstack/react-query';
import type { ContactList } from '~/types/crm';

export function useList(listId: string | null, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'lists', 'detail', listId, workspaceId],
    queryFn: async () => {
      if (!listId) return null;

      const response = await fetch(
        `/api/v1/crm/lists/${listId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch list');
      }

      const data = await response.json();
      // API returns {list: {...}}
      return data.list as ContactList;
    },
    enabled: !!listId && !!workspaceId,
  });
}
