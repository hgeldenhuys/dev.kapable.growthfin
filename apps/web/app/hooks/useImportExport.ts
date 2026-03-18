/**
 * useImportExport Hook
 * React Query hooks for importing and exporting CRM data
 */

import { useMutation, useQuery } from '@tanstack/react-query';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface ImportContactsRequest {
  workspaceId: string;
  records: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    emailSecondary?: string;
    phone?: string;
    phoneSecondary?: string;
    mobile?: string;
    title?: string;
    department?: string;
    leadSource?: string;
    status?: string;
    lifecycleStage?: string;
    customFields?: Record<string, any>;
  }>;
  ownerId: string;
}

interface ImportLeadsRequest {
  workspaceId: string;
  records: Array<{
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    title?: string;
    source: string;
    status?: string;
    score?: number;
    customFields?: Record<string, any>;
  }>;
  ownerId: string;
  createdById: string;
  updatedById: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  list?: {
    id: string;
    name: string;
    type: string;
    totalContacts: number;
  };
}

interface ExportOptions {
  fields: string[];
  filters?: Record<string, any>;
}

/**
 * Import contacts from CSV data
 */
export function useImportContacts() {
  return useMutation({
    mutationFn: async (data: ImportContactsRequest): Promise<ImportResult> => {
      const response = await fetch(`/api/v1/crm/contacts/import?workspaceId=${data.workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to import contacts');
      }

      return response.json();
    },
  });
}

/**
 * Import leads from CSV data
 */
export function useImportLeads() {
  return useMutation({
    mutationFn: async (data: ImportLeadsRequest): Promise<ImportResult> => {
      const response = await fetch(`/api/v1/crm/leads/import?workspaceId=${data.workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to import leads');
      }

      return response.json();
    },
  });
}

/**
 * Export contacts to CSV
 */
export function useExportContacts() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      options,
    }: {
      workspaceId: string;
      options: ExportOptions;
    }) => {
      const queryParams = new URLSearchParams({
        workspaceId,
        fields: options.fields.join(','),
      });

      // Add filters if provided
      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value) {
            queryParams.append(key, String(value));
          }
        }
      }

      const response = await fetch(
        `/api/v1/crm/contacts/export?${queryParams}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to export contacts');
      }

      // Return array of contacts
      const data = await response.json();
      return data.contacts || [];
    },
  });
}

/**
 * Export leads to CSV
 */
export function useExportLeads() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      options,
    }: {
      workspaceId: string;
      options: ExportOptions;
    }) => {
      const queryParams = new URLSearchParams({
        workspaceId,
        fields: options.fields.join(','),
      });

      // Add filters if provided
      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value) {
            queryParams.append(key, String(value));
          }
        }
      }

      const response = await fetch(
        `/api/v1/crm/leads/export?${queryParams}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to export leads');
      }

      // Return array of leads
      const data = await response.json();
      return data.leads || [];
    },
  });
}

/**
 * Download sample CSV template
 */
export function useDownloadTemplate(entityType: 'contacts' | 'leads') {
  return useQuery({
    queryKey: ['crm', entityType, 'template'],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/${entityType}/template`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      return blob;
    },
    enabled: false, // Only run when manually triggered
  });
}
