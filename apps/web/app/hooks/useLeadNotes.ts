/**
 * useLeadNotes Hook
 * Hook for managing lead notes with CRUD operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';


interface Note {
  id: string;
  content: string;
  content_html?: string;
  is_private: boolean;
  created_at: string;
  updated_at?: string;
  created_by: {
    id: string;
    name: string;
    avatar?: string;
  };
  mentioned_user_ids?: string[];
}

interface CreateNoteRequest {
  leadId: string;
  workspaceId: string;
  content: string;
  is_private: boolean;
  mentioned_user_ids: string[];
  created_by: string;
}

interface UpdateNoteRequest {
  noteId: string;
  workspaceId: string;
  content: string;
  is_private: boolean;
  mentioned_user_ids: string[];
}

/**
 * Fetch notes for a lead
 */
export function useLeadNotes(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'leads', leadId, 'notes', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/notes?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }
      const data = await response.json();
      return data.notes || [] as Note[];
    },
    enabled: !!leadId && !!workspaceId,
    retry: 1, // Limit retries - notes endpoint may not be implemented yet
  });
}

/**
 * Create a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteRequest) => {
      const response = await fetch(
        `/api/v1/crm/leads/${data.leadId}/notes?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: data.content,
            is_private: data.is_private,
            mentioned_user_ids: data.mentioned_user_ids,
            created_by: data.created_by,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create note');
      }

      return response.json() as Promise<Note>;
    },
    onSuccess: (data, variables) => {
      // Invalidate notes list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'leads', variables.leadId, 'notes', variables.workspaceId],
      });
    },
  });
}

/**
 * Update a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateNoteRequest) => {
      const response = await fetch(
        `/api/v1/crm/leads/notes/${data.noteId}?workspaceId=${data.workspaceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: data.content,
            is_private: data.is_private,
            mentioned_user_ids: data.mentioned_user_ids,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update note');
      }

      return response.json() as Promise<Note>;
    },
    onSuccess: (data, variables) => {
      // Invalidate notes list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'leads', 'notes', variables.workspaceId],
      });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      workspaceId,
    }: {
      noteId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/leads/notes/${noteId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete note');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate notes list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'leads', 'notes', variables.workspaceId],
      });
    },
  });
}
