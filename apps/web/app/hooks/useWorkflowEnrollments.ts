/**
 * useWorkflowEnrollments Hook
 * React Query hooks for workflow enrollment and execution management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

// Types
export interface WorkflowEnrollment {
  id: string;
  workspaceId: string;
  workflowId: string;
  leadId: string;
  currentStepId: string;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  context: any; // JSONB - execution variables
  retryCount: number;
  lastExecutedAt?: string;
  completedAt?: string;
  jobId?: string;
  createdAt: string;
}

export interface WorkflowExecution {
  id: string;
  workspaceId: string;
  enrollmentId: string;
  stepId: string;
  stepType: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: any;
  error?: string;
}

interface EnrollLeadRequest {
  workflowId: string;
  workspaceId: string;
  leadId: string;
  context?: any;
}

interface ListEnrollmentsOptions {
  workflowId: string;
  workspaceId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get enrollments for a workflow
 */
export function useWorkflowEnrollments(options: ListEnrollmentsOptions) {
  const { workflowId, workspaceId, status, limit = 50, offset = 0 } = options;

  return useQuery({
    queryKey: ['crm', 'workflow-enrollments', 'list', workflowId, workspaceId, status, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        ...(status && { status }),
        limit: String(limit),
        offset: String(offset),
      });

      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${workflowId}/enrollments?${params}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch enrollments: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as WorkflowEnrollment[];
    },
    enabled: !!workflowId && !!workspaceId,
  });
}

/**
 * Get single enrollment by ID
 */
export function useEnrollment(enrollmentId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'workflow-enrollments', 'detail', enrollmentId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/enrollments/${enrollmentId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch enrollment: ${response.statusText}`);
      }
      return response.json() as Promise<WorkflowEnrollment>;
    },
    enabled: !!enrollmentId && !!workspaceId,
    refetchInterval: (data) => {
      // Auto-refresh if enrollment is active
      return data?.status === 'active' ? 5000 : false;
    },
  });
}

/**
 * Get execution history for an enrollment
 */
export function useEnrollmentExecutions(enrollmentId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'workflow-executions', 'by-enrollment', enrollmentId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/enrollments/${enrollmentId}/executions?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch execution history: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as WorkflowExecution[];
    },
    enabled: !!enrollmentId && !!workspaceId,
  });
}

/**
 * Get recent executions (monitoring)
 */
export function useRecentExecutions(workspaceId: string, seconds = 3600) {
  return useQuery({
    queryKey: ['crm', 'workflow-executions', 'recent', workspaceId, seconds],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/executions/recent?workspaceId=${workspaceId}&seconds=${seconds}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch recent executions: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as WorkflowExecution[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Get failed executions (error analysis)
 */
export function useFailedExecutions(workspaceId: string, limit = 100) {
  return useQuery({
    queryKey: ['crm', 'workflow-executions', 'failed', workspaceId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/executions/failed?workspaceId=${workspaceId}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch failed executions: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as WorkflowExecution[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Enroll a lead in a workflow
 */
export function useEnrollLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EnrollLeadRequest) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/${data.workflowId}/enroll?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: data.leadId,
            context: data.context,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to enroll lead');
      }

      return response.json() as Promise<WorkflowEnrollment>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'workflow-enrollments', 'list', variables.workflowId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaign-workflows', 'detail', variables.workflowId, variables.workspaceId],
      });
    },
  });
}

/**
 * Complete an enrollment
 */
export function useCompleteEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ enrollmentId, workspaceId }: { enrollmentId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/enrollments/${enrollmentId}/complete?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to complete enrollment');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'workflow-enrollments', 'detail', variables.enrollmentId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'workflow-enrollments', 'list'],
      });
    },
  });
}

/**
 * Cancel an enrollment
 */
export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ enrollmentId, workspaceId }: { enrollmentId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-workflows/enrollments/${enrollmentId}/cancel?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to cancel enrollment');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'workflow-enrollments', 'detail', variables.enrollmentId, variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'workflow-enrollments', 'list'],
      });
    },
  });
}
