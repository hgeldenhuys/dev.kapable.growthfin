/**
 * useEmailTemplates Hook
 * CRUD operations for email templates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateInput {
  workspaceId: string;
  userId: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  category?: string;
  isActive?: boolean;
}

export interface UpdateEmailTemplateInput {
  templateId: string;
  workspaceId: string;
  userId: string;
  data: Partial<Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>>;
}

/**
 * Fetch all email templates for a workspace
 */
export function useEmailTemplates(workspaceId: string, category?: string) {
  return useQuery({
    queryKey: ['email-templates', workspaceId, category],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });
      if (category) {
        params.append('category', category);
      }
      const response = await fetch(`/api/v1/crm/email-templates?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load email templates');
      }
      return response.json() as Promise<EmailTemplate[]>;
    },
    enabled: !!workspaceId,
  });
}

/**
 * Fetch a single email template
 */
export function useEmailTemplate(workspaceId: string, templateId: string) {
  return useQuery({
    queryKey: ['email-templates', workspaceId, templateId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/email-templates/${templateId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error('Failed to load email template');
      }
      return response.json() as Promise<EmailTemplate>;
    },
    enabled: !!workspaceId && !!templateId,
  });
}

/**
 * Create a new email template
 */
export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEmailTemplateInput): Promise<EmailTemplate> => {
      const response = await fetch('/api/v1/crm/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create email template');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates', variables.workspaceId] });
    },
  });
}

/**
 * Update an email template
 */
export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId, userId, data }: UpdateEmailTemplateInput): Promise<EmailTemplate> => {
      const response = await fetch(`/api/v1/crm/email-templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, workspaceId, userId }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update email template');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates', variables.workspaceId] });
    },
  });
}

/**
 * Delete an email template (soft delete)
 */
export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, workspaceId }: { templateId: string; workspaceId: string }): Promise<void> => {
      const response = await fetch(`/api/v1/crm/email-templates/${templateId}?workspaceId=${workspaceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete email template');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates', variables.workspaceId] });
    },
  });
}
