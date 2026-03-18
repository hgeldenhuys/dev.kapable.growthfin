/**
 * useWorkItemProvenance Hook (UI-001)
 * Fetches source details and progress for work items
 */

import { useQuery } from '@tanstack/react-query';
import type { SourceType } from '@agios/db';

interface SourceProgress {
  total: number;
  pending: number;
  claimed: number;
  inProgress: number;
  completed: number;
  expired: number;
  cancelled: number;
}

interface BatchDetails {
  id: string;
  name: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
}

interface CampaignDetails {
  id: string;
  name: string;
  status: string;
}

interface UseWorkItemProvenanceOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch source progress stats
 */
export function useSourceProgress(
  workspaceId: string | undefined,
  sourceType: SourceType | undefined,
  sourceId: string | undefined,
  options: UseWorkItemProvenanceOptions = {}
) {
  return useQuery<SourceProgress>({
    queryKey: ['work-items', 'source-progress', sourceType, sourceId],
    queryFn: async () => {
      if (!workspaceId || !sourceType || !sourceId) {
        throw new Error('Missing required parameters');
      }

      const params = new URLSearchParams({
        workspaceId,
        sourceType,
        sourceId,
      });

      const response = await fetch(`/api/v1/work-items/source-progress?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch source progress');
      }

      return response.json();
    },
    enabled: options.enabled !== false && !!workspaceId && !!sourceType && !!sourceId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch batch details (when sourceType is 'batch')
 */
export function useBatchDetails(
  workspaceId: string | undefined,
  batchId: string | undefined,
  options: UseWorkItemProvenanceOptions = {}
) {
  return useQuery<BatchDetails>({
    queryKey: ['batches', batchId],
    queryFn: async () => {
      if (!workspaceId || !batchId) {
        throw new Error('Missing required parameters');
      }

      const response = await fetch(`/api/v1/crm/batches/${batchId}?workspaceId=${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch details');
      }

      return response.json();
    },
    enabled: options.enabled !== false && !!workspaceId && !!batchId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch campaign details (when sourceType is 'campaign')
 */
export function useCampaignDetails(
  workspaceId: string | undefined,
  campaignId: string | undefined,
  options: UseWorkItemProvenanceOptions = {}
) {
  return useQuery<CampaignDetails>({
    queryKey: ['campaigns', campaignId],
    queryFn: async () => {
      if (!workspaceId || !campaignId) {
        throw new Error('Missing required parameters');
      }

      const response = await fetch(`/api/v1/crm/campaigns/${campaignId}?workspaceId=${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaign details');
      }

      return response.json();
    },
    enabled: options.enabled !== false && !!workspaceId && !!campaignId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
}

/**
 * Combined hook for provenance data
 */
export function useWorkItemProvenance(
  workspaceId: string | undefined,
  sourceType: SourceType | null | undefined,
  sourceId: string | null | undefined,
  options: UseWorkItemProvenanceOptions = {}
) {
  const progress = useSourceProgress(
    workspaceId,
    sourceType ?? undefined,
    sourceId ?? undefined,
    { enabled: options.enabled !== false && !!sourceType && !!sourceId }
  );

  const batch = useBatchDetails(
    workspaceId,
    sourceType === 'batch' ? sourceId ?? undefined : undefined,
    { enabled: options.enabled !== false && sourceType === 'batch' && !!sourceId }
  );

  const campaign = useCampaignDetails(
    workspaceId,
    sourceType === 'campaign' ? sourceId ?? undefined : undefined,
    { enabled: options.enabled !== false && sourceType === 'campaign' && !!sourceId }
  );

  return {
    progress,
    batch,
    campaign,
    isLoading: progress.isLoading || batch.isLoading || campaign.isLoading,
  };
}
