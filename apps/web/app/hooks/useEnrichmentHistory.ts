/**
 * useEnrichmentHistory Hook
 * React Query hooks for enrichment history tracking
 */

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from './useWorkspace';
import { useEnrichmentHistoryStream } from './useEnrichmentHistoryStream';

export interface EnrichmentHistoryEntry {
  id: string;
  enrichmentTaskId: string;
  entityId: string;
  entityType: 'contact' | 'lead';
  enrichmentData: Record<string, any>;
  enrichmentReport: string | null;
  enrichmentSummary: string | null;
  changesSinceLast: string | null;
  createdAt: string;
  status?: 'pending' | 'completed' | 'failed';
  templateSnapshot: {
    id: string;
    name: string;
    templateType: string;
  } | null;
}

export interface EnrichmentHistoryResponse {
  history: EnrichmentHistoryEntry[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Get enrichment history for a lead or contact
 */
export function useEnrichmentHistory(
  entityId: string,
  entityType: 'contact' | 'lead',
  options?: {
    enableRealtime?: boolean;
  }
) {
  const workspaceId = useWorkspaceId();

  // Enable SSE streaming if requested
  const { isConnected } = options?.enableRealtime
    ? useEnrichmentHistoryStream(workspaceId)
    : { isConnected: false };

  return useQuery<EnrichmentHistoryResponse>({
    queryKey: ['enrichment-history', entityId, entityType, workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/crm/enrichment-history?workspaceId=${workspaceId}&entityId=${entityId}&entityType=${entityType}`
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch enrichment history');
      }

      const data = await res.json();
      return data as EnrichmentHistoryResponse;
    },
    enabled: !!workspaceId && !!entityId,
    // Disable polling if SSE is enabled and connected
    refetchInterval: options?.enableRealtime && isConnected ? false : 30000,
  });
}

/**
 * Get a single enrichment history entry with full details
 */
export function useEnrichmentHistoryEntry(id: string | null) {
  const workspaceId = useWorkspaceId();

  return useQuery<EnrichmentHistoryEntry>({
    queryKey: ['enrichment-history-entry', id, workspaceId],
    queryFn: async () => {
      if (!id) throw new Error('Entry ID is required');

      const res = await fetch(
        `/api/v1/crm/enrichment-history/${id}?workspaceId=${workspaceId}`
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch enrichment entry');
      }

      const data = await res.json();
      return data as EnrichmentHistoryEntry;
    },
    enabled: !!workspaceId && !!id,
  });
}
