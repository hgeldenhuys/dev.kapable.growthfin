/**
 * useListFilterOptions Hook
 * Fetches distinct values for a custom field from a list for filter dropdowns
 */

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UseListFilterOptionsParams {
  listId: string;
  workspaceId: string;
  fieldName: string;
  enabled?: boolean;
}

/**
 * Fetch distinct values for a custom field in a list
 * Used to populate filter dropdowns dynamically
 */
export function useListFilterOptions(
  listId: string,
  workspaceId: string,
  fieldName: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['listFilterOptions', listId, workspaceId, fieldName],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        field: fieldName,
      });

      const response = await fetch(
        `/api/v1/crm/lists/${listId}/filter-options?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error Loading Filter Options', { description: `Failed to load options for ${fieldName}: ${errorText}` });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      // Extract just the values from { value, count } objects returned by API
      const optionsArray = data.options as Array<{ value: string; count: number }>;
      return optionsArray.map((opt) => opt.value);
    },
    staleTime: 5 * 60 * 1000,  // Cache for 5 minutes
    enabled: enabled && !!listId && !!workspaceId && !!fieldName,
    retry: 1,  // Only retry once on failure
  });
}
