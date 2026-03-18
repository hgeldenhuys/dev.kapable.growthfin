/**
 * useResearch Hooks
 * React Query hooks for research API endpoints
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrichmentPreview } from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

// Types
export interface ResearchSession {
  id: string;
  workspaceId: string;
  entityType: 'contact' | 'company' | 'deal';
  entityId: string;
  objective: string;
  scope: 'basic' | 'deep';
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';
  maxQueries: number;
  queriesUsed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFinding {
  id: string;
  sessionId: string;
  category: string;
  finding: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResearchSessionRequest {
  workspaceId: string;
  entityType: 'contact' | 'company' | 'deal';
  entityId: string;
  objective: string;
  scope: 'basic' | 'deep';
  createdBy: string;
}

/**
 * Fetch all research sessions for a workspace
 */
export function useResearchSessions(workspaceId: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['research', 'sessions', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/research/sessions?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch research sessions: ${response.statusText}`);
      }
      const data = await response.json();
      return data as ResearchSession[];
    },
    enabled: !!workspaceId,
    refetchInterval: options?.refetchInterval || false,
  });
}

/**
 * Get a single research session by ID
 */
export function useResearchSession(sessionId: string, workspaceId: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['research', 'sessions', sessionId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/research/sessions/${sessionId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch research session: ${response.statusText}`);
      }
      const data = await response.json();
      return data.session as ResearchSession;
    },
    enabled: !!sessionId && !!workspaceId,
    refetchInterval: options?.refetchInterval || false,
  });
}

/**
 * Get findings for a session
 */
export function useResearchFindings(sessionId: string, workspaceId: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['research', 'findings', sessionId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/research/sessions/${sessionId}/findings?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch research findings: ${response.statusText}`);
      }
      const data = await response.json();
      return data as ResearchFinding[];
    },
    enabled: !!sessionId && !!workspaceId,
    refetchInterval: options?.refetchInterval || false,
  });
}

/**
 * Create a new research session
 */
export function useCreateResearchSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateResearchSessionRequest) => {
      const response = await fetch(`/api/v1/crm/research/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create research session');
      }

      const result = await response.json();
      return result.session as ResearchSession;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions', variables.workspaceId]
      });
    },
  });
}

/**
 * Start a research session
 */
export function useStartResearchSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, workspaceId }: { sessionId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/research/sessions/${sessionId}/start?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start research session');
      }

      const result = await response.json();
      return result.session as ResearchSession;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions', variables.sessionId, variables.workspaceId]
      });
    },
  });
}

/**
 * Stop a research session
 */
export function useStopResearchSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, workspaceId }: { sessionId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/research/sessions/${sessionId}/stop?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to stop research session');
      }

      const result = await response.json();
      return result.session as ResearchSession;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions', variables.sessionId, variables.workspaceId]
      });
    },
  });
}

/**
 * Approve a finding
 */
export function useApproveFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      findingId,
      workspaceId,
      reviewedBy,
    }: {
      findingId: string;
      workspaceId: string;
      reviewedBy: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/research/findings/${findingId}/approve?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewedBy }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to approve finding');
      }

      const result = await response.json();
      return result.finding as ResearchFinding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'findings', data.sessionId]
      });
    },
  });
}

/**
 * Reject a finding
 */
export function useRejectFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      findingId,
      workspaceId,
      reviewedBy,
      reviewNotes,
    }: {
      findingId: string;
      workspaceId: string;
      reviewedBy: string;
      reviewNotes?: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/research/findings/${findingId}/reject?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewedBy, reviewNotes }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to reject finding');
      }

      const result = await response.json();
      return result.finding as ResearchFinding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'findings', data.sessionId]
      });
    },
  });
}

/**
 * Preview enrichments before applying
 */
export function useEnrichmentPreview(sessionId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['research', 'preview', sessionId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/research/sessions/${sessionId}/preview?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch preview');
      }
      const data = await response.json();
      return data.preview as EnrichmentPreview;
    },
    enabled: !!sessionId && !!workspaceId,
  });
}

/**
 * Apply all approved findings to contact record
 */
export function useApplyEnrichments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      workspaceId,
      userId,
    }: {
      sessionId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/research/sessions/${sessionId}/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to apply enrichments');
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions']
      });
      queryClient.invalidateQueries({
        queryKey: ['research', 'sessions', variables.sessionId, variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['research', 'findings', variables.sessionId, variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['contacts']
      });
    },
  });
}

/**
 * Apply a single finding to contact record
 */
export function useApplySingleFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      findingId,
      workspaceId,
      userId,
    }: {
      findingId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/research/findings/${findingId}/apply-single`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to apply finding');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['research']
      });
      queryClient.invalidateQueries({
        queryKey: ['contacts']
      });
    },
  });
}
