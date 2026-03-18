/**
 * useLeads Hook - CQRS Commands Only
 *
 * ARCHITECTURE CHANGE (ARCH-001):
 * - Queries now come from BFF loaders (use useLoaderData in your components)
 * - This hook only handles COMMANDS (create, update, delete, convert)
 * - Mutations trigger React Router revalidation instead of React Query cache
 */

import { useMutation } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';
import type { Lead, CreateLeadRequest, UpdateLeadRequest, ConvertLeadRequest } from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

/**
 * @deprecated Use React Router loader instead. See apps/web/app/routes/dashboard.$workspaceId.crm.leads._index.tsx
 *
 * Migration guide:
 * 1. Add loader to your route that queries database directly
 * 2. Use useLoaderData() in component instead of this hook
 * 3. Subscribe to SSE for real-time updates with useRevalidator()
 */
export function useLeads() {
  throw new Error(
    'useLeads query hook is deprecated. Use React Router loader + useLoaderData instead. ' +
    'See apps/web/app/routes/dashboard.$workspaceId.crm.leads._index.tsx for pattern.'
  );
}

/**
 * @deprecated Use React Router loader instead. See apps/web/app/routes/dashboard.$workspaceId.crm.leads.$leadId._index.tsx
 *
 * Migration guide:
 * 1. Add loader to your route that queries database directly
 * 2. Use useLoaderData() in component instead of this hook
 * 3. Subscribe to SSE for real-time updates with useRevalidator()
 */
export function useLead() {
  throw new Error(
    'useLead query hook is deprecated. Use React Router loader + useLoaderData instead. ' +
    'See apps/web/app/routes/dashboard.$workspaceId.crm.leads.$leadId._index.tsx for pattern.'
  );
}

/**
 * Create a new lead (COMMAND)
 */
export function useCreateLead() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async (data: CreateLeadRequest) => {
      const response = await fetch(`/api/v1/crm/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create lead');
      }

      return response.json() as Promise<Lead>;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Update a lead (COMMAND)
 */
export function useUpdateLead() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({
      leadId,
      workspaceId,
      data,
    }: {
      leadId: string;
      workspaceId: string;
      data: UpdateLeadRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update lead');
      }

      return response.json() as Promise<Lead>;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Delete a lead (COMMAND)
 */
export function useDeleteLead() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ leadId, workspaceId }: { leadId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete lead');
      }

      return response.json();
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Convert lead to contact/account/opportunity (COMMAND)
 */
export function useConvertLead() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({
      leadId,
      data,
    }: {
      leadId: string;
      data: ConvertLeadRequest;
    }) => {
      const response = await fetch(`/api/v1/crm/leads/${leadId}/convert?workspaceId=${data.workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to convert lead');
      }

      return response.json();
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      // This will trigger loaders to refetch from database
      revalidator.revalidate();
    },
  });
}

/**
 * Bulk delete leads (COMMAND)
 */
export function useBulkDeleteLeads() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ leadIds, workspaceId }: { leadIds: string[]; workspaceId: string }) => {
      const promises = leadIds.map((leadId) =>
        fetch(`/api/v1/crm/leads/${leadId}?workspaceId=${workspaceId}`, {
          method: 'DELETE',
        })
      );

      const responses = await Promise.all(promises);
      const failed = responses.filter((r) => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} lead(s)`);
      }

      return { success: true, count: leadIds.length };
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}
