/**
 * useSearch Hook (Phase O)
 * Global full-text search across CRM entities
 */

import { useQuery } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import type { SearchResult, SearchFilters } from '~/types/crm';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export type SearchResultType = 'lead' | 'contact' | 'transcript';

export interface FullTextSearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  highlight?: string;
  metadata: Record<string, any>;
  rank: number;
}

export interface FullTextSearchResponse {
  results: FullTextSearchResult[];
  total: number;
  query: string;
  types: SearchResultType[];
}

export interface SearchSuggestion {
  text: string;
  type: string;
}

/**
 * Full-text search across leads, contacts, and transcripts (Phase O)
 */
export function useFullTextSearch(
  query: string,
  workspaceId: string,
  options?: {
    types?: SearchResultType[];
    limit?: number;
    offset?: number;
    enabled?: boolean;
  }
) {
  const debouncedQuery = useDeferredValue(query);
  const { types, limit = 20, offset = 0, enabled = true } = options || {};

  return useQuery({
    queryKey: ['search', 'fulltext', debouncedQuery, workspaceId, types, limit, offset],
    queryFn: async (): Promise<FullTextSearchResponse> => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        workspaceId,
        limit: String(limit),
        offset: String(offset),
      });

      if (types && types.length > 0) {
        params.set('types', types.join(','));
      }

      const response = await fetch(`/api/v1/crm/search?${params}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= 2 && !!workspaceId,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Search suggestions / autocomplete (Phase O)
 */
export function useSearchSuggestions(
  query: string,
  workspaceId: string,
  options?: {
    limit?: number;
    enabled?: boolean;
  }
) {
  const { limit = 10, enabled = true } = options || {};

  return useQuery({
    queryKey: ['search', 'suggestions', query, workspaceId, limit],
    queryFn: async (): Promise<{ suggestions: SearchSuggestion[] }> => {
      const params = new URLSearchParams({
        q: query,
        workspaceId,
        limit: String(limit),
      });

      const response = await fetch(`/api/v1/crm/search/suggestions?${params}`);
      if (!response.ok) {
        throw new Error('Suggestions failed');
      }
      return response.json();
    },
    enabled: enabled && query.length >= 1 && !!workspaceId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Legacy global search (deprecated - use useFullTextSearch instead)
 * @deprecated Use useFullTextSearch for Phase O full-text search
 */
export function useGlobalSearch(
  query: string,
  workspaceId: string,
  filters?: SearchFilters
) {
  const debouncedQuery = useDeferredValue(query);

  return useQuery({
    queryKey: ['crm', 'search', debouncedQuery, workspaceId, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        workspaceId,
      });

      if (filters?.entityTypes && filters.entityTypes.length > 0) {
        params.append('types', filters.entityTypes.join(','));
      }

      if (filters?.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }

      if (filters?.dateTo) {
        params.append('dateTo', filters.dateTo);
      }

      const response = await fetch(
        `/api/v1/crm/search?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Search Error', { description: errorText || 'Failed to perform search' });
        throw new Error(errorText || 'Failed to perform search');
      }

      const data = await response.json();
      return data.results as SearchResult[];
    },
    enabled: debouncedQuery.length >= 2 && !!workspaceId,
    staleTime: 30000, // Cache results for 30 seconds
  });
}
