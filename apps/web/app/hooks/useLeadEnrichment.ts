/**
 * useLeadEnrichment Hook
 * React hooks for AI-powered lead enrichment
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { toast } from 'sonner';


export interface EnrichedField {
  value: any;
  confidence: number;
  source: string;
}

export interface EnrichmentData {
  enrichment_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  enriched_at?: string;
  created_at?: string;
  enriched_fields?: Record<string, EnrichedField>;
  confidence_scores?: Record<string, number>;
  source: string;
  retry_count?: number;
  error_message?: string;
}

export interface TriggerEnrichmentRequest {
  leadId: string;
  workspaceId: string;
  sources?: ('company' | 'contact' | 'social')[];
  fields?: string[];
  force?: boolean;
}

export interface TriggerEnrichmentResponse {
  enrichment_id: string;
  status: 'pending' | 'in_progress';
  estimated_completion: string;
  sources_requested: string[];
}

/**
 * Get enrichment status and data for a lead.
 * When enrichment is active (pending/in_progress), also fetches created_at
 * from the history endpoint so the UI can show accurate elapsed time.
 */
export function useEnrichmentStatus(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'enrichment', leadId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/enrichment?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch enrichment status: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if response contains an error (API returns 200 with error object)
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      const result = data as EnrichmentData;

      // The status endpoint doesn't return created_at, so fetch it from history
      // when enrichment is active. This gives us accurate elapsed time on refresh.
      if (
        (result.status === 'in_progress' || result.status === 'pending') &&
        !result.created_at
      ) {
        try {
          const historyResp = await fetch(
            `/api/v1/crm/leads/${leadId}/enrichment/history?workspaceId=${workspaceId}`
          );
          if (historyResp.ok) {
            const historyData = await historyResp.json();
            const enrichments = historyData?.enrichments;
            if (Array.isArray(enrichments) && enrichments.length > 0) {
              // Most recent enrichment (already sorted desc by created_at)
              result.created_at = enrichments[0].created_at;
            }
          }
        } catch {
          // Non-critical — timer will just show 0s if history fetch fails
        }
      }

      return result;
    },
    enabled: !!leadId && !!workspaceId,
    refetchInterval: (query) => {
      // Poll more frequently if enrichment is in progress
      const status = query.state.data?.status;
      if (status === 'in_progress' || status === 'pending') {
        return 5000; // 5 seconds
      }
      return false; // Don't poll if completed or failed
    },
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Trigger manual enrichment for a lead
 */
export function useEnrichLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: TriggerEnrichmentRequest) => {
      const { leadId, workspaceId, sources, fields, force } = request;

      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/enrich?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources, fields, force }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'Failed to trigger enrichment';
        try {
          const parsed = JSON.parse(errorText);
          errorMsg = parsed.error || parsed.message || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      return response.json() as Promise<TriggerEnrichmentResponse>;
    },
    onSuccess: (data, variables) => {
      toast.success('Enrichment Started', { description: 'Lead enrichment has been queued. This may take up to 30 seconds.' });

      // Optimistically set enrichment status to in_progress so the UI
      // shows the spinner immediately (no waiting for server round-trip)
      queryClient.setQueryData(
        ['crm', 'enrichment', variables.leadId, variables.workspaceId],
        (old: EnrichmentData | undefined) => ({
          ...old,
          enrichment_id: data.enrichment_id || old?.enrichment_id || '',
          status: 'in_progress' as const,
          source: old?.source || 'manual',
          created_at: new Date().toISOString(),
        })
      );

      // Also invalidate the lead itself
      queryClient.invalidateQueries({
        queryKey: ['crm', 'leads', variables.leadId, variables.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error('Enrichment Failed', { description: error.message });
    },
  });
}

/**
 * BL-ENR-017: Cancel active enrichment for a lead
 */
export function useCancelEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, workspaceId }: { leadId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/enrichment/cancel?workspaceId=${workspaceId}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to cancel enrichment');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      toast.success('Enrichment Cancelled', { description: 'The enrichment job has been cancelled.' });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', variables.leadId, variables.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error('Cancel Failed', { description: error.message });
    },
  });
}

/**
 * Get confidence score color for UI
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get confidence score label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
}

/**
 * Format enriched field value for display
 */
export function formatEnrichedValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
