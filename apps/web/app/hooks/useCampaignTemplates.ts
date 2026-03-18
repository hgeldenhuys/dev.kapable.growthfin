/**
 * useCampaignTemplates Hook
 * React Query hooks for campaign template management with CQRS pattern
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { useEffect } from 'react';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

// Types
export interface CampaignTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  category: 'nurture' | 'promotion' | 'onboarding' | 'retention' | 'other';
  tags: string[];
  templateData: any; // JSONB - campaign configuration
  version: number;
  parentTemplateId?: string;
  isLatestVersion: boolean;
  usageCount: number;
  lastUsedAt?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface CreateTemplateRequest {
  workspaceId: string;
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  templateData: any;
  createdBy?: string;
}

interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  templateData?: any;
  status?: 'active' | 'archived';
}

interface ListTemplatesOptions {
  workspaceId: string;
  category?: string;
  status?: string;
  tags?: string[];
  latestOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Get recent templates (CQRS pattern - initial state)
 */
export function useRecentTemplates(workspaceId: string, seconds = 86400) {
  return useQuery({
    queryKey: ['crm', 'campaign-templates', 'recent', workspaceId, seconds],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/recent?workspaceId=${workspaceId}&seconds=${seconds}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch recent templates: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as CampaignTemplate[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Real-time SSE stream for template updates
 */
export function useTemplateStream(workspaceId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const eventSource = new EventSource(
      `/api/v1/crm/campaign-templates/stream?workspaceId=${workspaceId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        // Invalidate relevant queries to trigger refetch
        queryClient.invalidateQueries({
          queryKey: ['crm', 'campaign-templates', 'list', workspaceId],
        });
        queryClient.invalidateQueries({
          queryKey: ['crm', 'campaign-templates', 'recent', workspaceId],
        });
        if (update.templateId) {
          queryClient.invalidateQueries({
            queryKey: ['crm', 'campaign-templates', 'detail', update.templateId, workspaceId],
          });
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [workspaceId, queryClient]);
}

/**
 * List templates with filters
 */
export function useTemplates(options: ListTemplatesOptions) {
  const { workspaceId, category, status, tags, latestOnly = true, limit = 50, offset = 0 } = options;

  return useQuery({
    queryKey: ['crm', 'campaign-templates', 'list', workspaceId, category, status, tags, latestOnly, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        ...(category && { category }),
        ...(status && { status }),
        ...(tags && tags.length > 0 && { tags: JSON.stringify(tags) }),
        latestOnly: String(latestOnly),
        limit: String(limit),
        offset: String(offset),
      });

      const response = await apiRequest(`/api/v1/crm/campaign-templates?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as CampaignTemplate[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Get popular templates (most used)
 */
export function usePopularTemplates(workspaceId: string, limit = 10) {
  return useQuery({
    queryKey: ['crm', 'campaign-templates', 'popular', workspaceId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/popular?workspaceId=${workspaceId}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch popular templates: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as CampaignTemplate[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Get single template by ID
 */
export function useTemplate(templateId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaign-templates', 'detail', templateId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/${templateId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }
      return response.json() as Promise<CampaignTemplate>;
    },
    enabled: !!templateId && !!workspaceId,
  });
}

/**
 * Get template version history
 */
export function useTemplateVersions(templateId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaign-templates', 'versions', templateId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/${templateId}/versions?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch template versions: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as CampaignTemplate[];
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
      const response = await apiRequest(`/api/v1/crm/campaign-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create template');
      }

      return response.json() as Promise<CampaignTemplate>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'recent', variables.workspaceId],
      });
    },
  });
}

/**
 * Update a template
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      workspaceId,
      data,
    }: {
      templateId: string;
      workspaceId: string;
      data: UpdateTemplateRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/${templateId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update template');
      }

      return response.json() as Promise<CampaignTemplate>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'detail', variables.templateId, variables.workspaceId],
      });
    },
  });
}

/**
 * Create a new version of a template
 */
export function useCreateTemplateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      workspaceId,
      data,
    }: {
      templateId: string;
      workspaceId: string;
      data: Partial<CampaignTemplate>;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/${templateId}/version?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create template version');
      }

      return response.json() as Promise<CampaignTemplate>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'versions', variables.templateId, variables.workspaceId],
      });
    },
  });
}

/**
 * Increment usage count when template is used
 */
export function useTemplateUsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId }: { templateId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/${templateId}/use?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to mark template as used');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'detail', variables.templateId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'popular', variables.workspaceId],
      });
    },
  });
}

/**
 * Delete (soft delete) a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId }: { templateId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-templates/${templateId}?workspaceId=${workspaceId}`,
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
        queryKey: ['crm', 'campaign-templates', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-templates', 'recent', variables.workspaceId],
      });
    },
  });
}
