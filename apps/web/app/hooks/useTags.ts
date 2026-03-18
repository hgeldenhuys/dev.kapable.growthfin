/**
 * Hook to fetch tags from API
 * Returns latest tags sorted by last_used_at DESC
 */

import { useQuery } from '@tanstack/react-query';

export interface Tag {
  tag_name: string;
  event_count: number;
  first_used: string;
  last_used: string;
}

export interface TagsResponse {
  tags: Tag[];
}

export function useTags(limit = 10) {
  return useQuery({
    queryKey: ['tags', limit],
    queryFn: async () => {
      const response = await fetch(`/api/v1/tags?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      const data: TagsResponse = await response.json();
      return data.tags;
    },
    staleTime: 30_000, // 30 seconds
  });
}
