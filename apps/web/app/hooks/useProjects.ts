/**
 * useProjects Hook
 *
 * Projects data using TanStack Query
 * (SSE disabled - not needed for projects)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApiV1Workspaces,
  postApiV1Workspaces,
  putApiV1WorkspacesById,
  deleteApiV1WorkspacesById,
} from '~/lib/api-client/config';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

/**
 * Fetch all projects
 * NOTE: Uses regular React Query without SSE as projects don't need real-time updates
 */
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      // Fetch from REST API projects endpoint
      const response = await fetch(`/api/v1/projects`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; slug: string; ownerId: string }) => {
      const response = await postApiV1Workspaces({ body: data });
      if (response.error) {
        throw new Error(String(response.error));
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate projects query to refetch
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; slug: string; ownerId: string } }) => {
      const response = await putApiV1WorkspacesById({
        path: { id },
        body: data,
      });
      if (response.error) {
        throw new Error(String(response.error));
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await deleteApiV1WorkspacesById({ path: { id } });
      if (response.error) {
        throw new Error(String(response.error));
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
