/**
 * useContacts Hook
 * Real-time contacts data using TanStack Query + Shared SSE
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type { Contact, CreateContactRequest, UpdateContactRequest } from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseContactsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch contacts with real-time SSE updates
 */
export function useContacts({ workspaceId, enabled = true }: UseContactsOptions) {
  return useSharedSSE({
    table: 'crm_contacts',
    queryKey: ['crm', 'contacts', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/contacts?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.statusText}`);
      }
      const data = await response.json();
      return data?.contacts || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single contact by ID
 */
export function useContact(contactId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'contacts', contactId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/contacts/${contactId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch contact: ${response.statusText}`);
      }
      return response.json() as Promise<Contact>;
    },
    enabled: !!contactId && !!workspaceId,
  });
}

/**
 * Create a new contact
 */
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContactRequest) => {
      const response = await fetch(`/api/v1/crm/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create contact');
      }

      return response.json() as Promise<Contact>;
    },
    onSuccess: (data, variables) => {
      // Invalidate contacts list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'contacts', variables.workspaceId]
      });
    },
  });
}

/**
 * Update a contact
 */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      workspaceId,
      data,
    }: {
      contactId: string;
      workspaceId: string;
      data: UpdateContactRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/contacts/${contactId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update contact');
      }

      return response.json() as Promise<Contact>;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific contact
      queryClient.invalidateQueries({
        queryKey: ['crm', 'contacts', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'contacts', variables.contactId, variables.workspaceId]
      });
    },
  });
}

/**
 * Delete a contact
 */
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, workspaceId }: { contactId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/contacts/${contactId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete contact');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'contacts', variables.workspaceId]
      });
    },
  });
}
