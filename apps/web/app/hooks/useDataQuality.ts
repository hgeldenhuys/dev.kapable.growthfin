/**
 * useDataQuality Hooks
 * Hooks for fetching and managing data quality metrics
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';


export interface WorkspaceDataQuality {
  workspace_id: string;
  summary: {
    avg_quality_score: number;
    leads_with_issues: number;
    total_leads: number;
    critical_issues: number;
    leads_needing_enrichment: number;
  };
  distribution: {
    good: number; // 80-100
    fair: number; // 50-79
    poor: number; // 0-49
  };
  issues_by_type: {
    invalid_email: number;
    invalid_phone: number;
    missing_company: number;
    missing_title: number;
    missing_industry: number;
    missing_revenue: number;
  };
  last_validated_at: string;
}

export interface LeadDataQuality {
  lead_id: string;
  workspace_id: string;
  overall_score: number;
  completeness_score: number;
  validity_score: number;
  validation_results: Record<string, any>;
  issue_count: number;
  critical_issues: string[];
  last_validated_at: string;
}

export interface QualityIssue {
  field: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

export interface LeadWithQualityIssues {
  lead_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  overall_score: number;
  critical_issues: string[];
  issue_count: number;
}

/**
 * Fetch workspace-level data quality metrics
 */
export function useWorkspaceDataQuality(workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'data-quality'],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/data-quality?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch data quality metrics');
      }

      return response.json() as Promise<WorkspaceDataQuality>;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch data quality for a specific lead
 */
export function useLeadDataQuality(leadId: string | null, workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', leadId, 'data-quality'],
    queryFn: async () => {
      if (!leadId) return null;

      const response = await fetch(
        `/api/v1/crm/data-quality/leads/${leadId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch lead data quality');
      }

      const data = await response.json();

      // Check if response contains an error (API returns 200 with error object)
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data as LeadDataQuality;
    },
    enabled: !!leadId && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Fetch leads with quality issues
 */
export function useLeadsWithQualityIssues(workspaceId: string, minScore?: number, maxScore?: number) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'leads', 'quality-issues', minScore, maxScore],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('workspaceId', workspaceId);
      if (minScore !== undefined) params.set('minScore', minScore.toString());
      if (maxScore !== undefined) params.set('maxScore', maxScore.toString());

      const response = await fetch(
        `/api/v1/crm/data-quality/issues?${params.toString()}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch leads with quality issues');
      }

      return response.json() as Promise<{ leads: LeadWithQualityIssues[] }>;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Trigger bulk validation for workspace leads
 */
export function useBulkValidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      leadIds,
    }: {
      workspaceId: string;
      leadIds?: string[];
    }) => {
      const response = await fetch(
        `/api/v1/crm/data-quality/validate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ leadIds }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to trigger bulk validation');
      }

      return response.json();
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'data-quality'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'leads'],
      });
    },
  });
}

/**
 * Trigger enrichment for a specific lead
 */
export function useEnrichLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      leadId,
    }: {
      workspaceId: string;
      leadId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/enrich?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to trigger enrichment');
      }

      return response.json();
    },
    onSuccess: (_, { workspaceId, leadId }) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'leads', leadId, 'data-quality'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'leads', leadId],
      });
    },
  });
}

/**
 * Subscribe to data quality updates via SSE
 */
export function useDataQualityUpdates(workspaceId: string) {
  // This would be implemented with SSE connection
  // For now, we'll use polling as a fallback
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'data-quality', 'stream'],
    queryFn: async () => {
      // SSE implementation would go here
      // For now, return null to indicate streaming not yet implemented
      return null;
    },
    enabled: false, // Disable until SSE is implemented
    refetchInterval: 30000, // Fallback: Poll every 30 seconds
  });
}
