/**
 * useTemplates Hook
 * React Query hooks for enrichment templates API operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';

// Template types
export interface Template {
  id: string;
  workspaceId: string;
  type: 'enrichment' | 'scoring' | 'export';
  name: string;
  description: string | null;
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number | null;
  estimatedCostPerContact: number | null;
  metadata: Record<string, any> | null;
  lastTestedAt: string | null;
  lastTestResults: any | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  usageCount?: number;
  lastUsedAt?: string | null;
}

export interface CreateTemplateRequest {
  workspaceId: string;
  type: 'enrichment' | 'scoring' | 'export';
  name: string;
  description?: string | null;
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number | null;
  estimatedCostPerContact?: number | null;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string | null;
  prompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number | null;
  estimatedCostPerContact?: number | null;
}

export interface DryRunRequest {
  listId: string;
  sampleSize: number;
}

export interface DryRunResult {
  samples: Array<{
    contactId: string;
    contactName: string;
    originalData: Record<string, any>;
    enrichedFields: Record<string, any>;
    rawResponse: string;
    cost: number;
    tokensUsed: number;
    status: 'success' | 'failure';
    error?: string;
  }>;
  totalCost: number;
  successRate: number;
  testedAt: string;
}

interface UseTemplatesOptions {
  workspaceId: string;
  type?: string;
  search?: string;
  enabled?: boolean;
}

/**
 * List enrichment templates with optional filtering
 */
export function useTemplates({ workspaceId, type, search, enabled = true }: UseTemplatesOptions) {
  const params = new URLSearchParams({ workspaceId });
  if (type) params.append('type', type);
  if (search) params.append('search', search);

  return useQuery({
    queryKey: ['crm', 'templates', workspaceId, type, search],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/enrichment/templates?${params.toString()}`);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch templates');
      }
      const data = await response.json();
      return (data.templates || []) as Template[];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single template by ID
 */
export function useTemplate(templateId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'templates', templateId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/enrichment/templates/${templateId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch template');
      }
      const data = await response.json();
      return data.template as Template;
    },
    enabled: !!templateId && !!workspaceId,
  });
}

/**
 * Create a new template
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemplateRequest) => {
      const response = await fetch(`/api/v1/crm/enrichment/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create template');
      }

      const result = await response.json();
      return result.template as Template;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'templates', variables.workspaceId],
      });
    },
  });
}

/**
 * Update an existing template
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      templateId: string;
      workspaceId: string;
      updates: UpdateTemplateRequest;
    }) => {
      const { templateId, workspaceId, updates } = data;

      const response = await fetch(
        `/api/v1/crm/enrichment/templates/${templateId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, ...updates }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update template');
      }

      const result = await response.json();
      return result.template as Template;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'templates', variables.templateId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'templates', variables.workspaceId],
      });
    },
  });
}

/**
 * Delete a template (soft delete)
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId }: { templateId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/enrichment/templates/${templateId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete template');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'templates', variables.workspaceId],
      });
    },
  });
}

/**
 * Duplicate a template
 */
export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId }: { templateId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/enrichment/templates/${templateId}/duplicate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to duplicate template');
      }

      const result = await response.json();
      return result.template as Template;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'templates', variables.workspaceId],
      });
    },
  });
}

/**
 * Run a dry-run test on a template
 */
export function useTemplateDryRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      templateId: string;
      workspaceId: string;
      dryRun: DryRunRequest;
    }) => {
      const { templateId, workspaceId, dryRun } = data;

      const response = await fetch(
        `/api/v1/crm/enrichment/templates/${templateId}/dry-run?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dryRun),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to run dry-run test');
      }

      return response.json() as Promise<DryRunResult>;
    },
    onSuccess: (data, variables) => {
      // Invalidate template to get updated lastTestedAt
      queryClient.invalidateQueries({
        queryKey: ['crm', 'templates', variables.templateId, variables.workspaceId],
      });
    },
  });
}
