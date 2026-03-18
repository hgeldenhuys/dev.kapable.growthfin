/**
 * useProjectVoiceSettings Hook
 * Fetch and update project-specific voice settings
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Voice } from '../types/voices';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface ProjectVoiceSettings {
  id: string;
  projectId: string;
  userVoiceId: string | null;
  assistantVoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVoiceSettingsResponse {
  settings: ProjectVoiceSettings | null;
  voices: {
    user: Voice | null;
    assistant: Voice | null;
  };
}

/**
 * Fetch project voice settings
 */
export function useProjectVoiceSettings(projectId: string | null) {
  return useQuery<ProjectVoiceSettingsResponse | null>({
    queryKey: ['project-voice-settings', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const response = await fetch(
        `/api/v1/voice-settings/projects/${projectId}`
      );

      // 404 means no custom settings exist yet (will inherit from global)
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch project voice settings: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

/**
 * Update project voice settings
 */
export function useUpdateProjectVoiceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      userVoiceId,
      assistantVoiceId,
    }: {
      projectId: string;
      userVoiceId: string | null;
      assistantVoiceId: string | null;
    }) => {
      const response = await fetch(
        `/api/v1/voice-settings/projects/${projectId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userVoiceId,
            assistantVoiceId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update voice settings');
      }

      return response.json() as Promise<ProjectVoiceSettingsResponse>;
    },
    onSuccess: (data, variables) => {
      // Invalidate the query
      queryClient.invalidateQueries({
        queryKey: ['project-voice-settings', variables.projectId],
      });

      toast.success('Settings Saved', { description: 'Project voice settings have been updated' });
    },
    onError: (error) => {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to save settings' });
    },
  });
}
