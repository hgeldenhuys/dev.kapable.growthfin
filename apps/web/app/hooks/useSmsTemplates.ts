/**
 * useSmsTemplates Hook
 * CRUD operations for SMS templates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  category?: string;
  maxSegments: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSmsTemplateInput {
  workspaceId: string;
  userId: string;
  name: string;
  body: string;
  variables?: string[];
  category?: string;
  maxSegments?: number;
  isActive?: boolean;
}

export interface UpdateSmsTemplateInput {
  templateId: string;
  workspaceId: string;
  userId: string;
  data: Partial<Omit<SmsTemplate, 'id' | 'createdAt' | 'updatedAt'>>;
}

/**
 * Fetch all SMS templates for a workspace
 */
export function useSmsTemplates(workspaceId: string, category?: string) {
  return useQuery({
    queryKey: ['sms-templates', workspaceId, category],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });
      if (category) {
        params.append('category', category);
      }
      const response = await fetch(`/api/v1/crm/sms-templates?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load SMS templates');
      }
      return response.json() as Promise<SmsTemplate[]>;
    },
    enabled: !!workspaceId,
  });
}

/**
 * Fetch a single SMS template
 */
export function useSmsTemplate(workspaceId: string, templateId: string) {
  return useQuery({
    queryKey: ['sms-templates', workspaceId, templateId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/sms-templates/${templateId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error('Failed to load SMS template');
      }
      return response.json() as Promise<SmsTemplate>;
    },
    enabled: !!workspaceId && !!templateId,
  });
}

/**
 * Create a new SMS template
 */
export function useCreateSmsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSmsTemplateInput): Promise<SmsTemplate> => {
      const response = await fetch('/api/v1/crm/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create SMS template');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates', variables.workspaceId] });
    },
  });
}

/**
 * Update an SMS template
 */
export function useUpdateSmsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId, userId, data }: UpdateSmsTemplateInput): Promise<SmsTemplate> => {
      const response = await fetch(`/api/v1/crm/sms-templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update SMS template');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates', variables.workspaceId] });
    },
  });
}

/**
 * Delete an SMS template (soft delete)
 */
export function useDeleteSmsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId }: { templateId: string; workspaceId: string }): Promise<void> => {
      const response = await fetch(`/api/v1/crm/sms-templates/${templateId}?workspaceId=${workspaceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete SMS template');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates', variables.workspaceId] });
    },
  });
}
