/**
 * useLeadRouting Hook
 * React hooks for AI-powered automated lead routing
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { toast } from 'sonner';


export interface RoutingAssignment {
  id: string;
  lead_id: string;
  assigned_to: string;
  assigned_by?: string;
  routing_reason: string;
  assignment_reason?: string;
  routed_at: string;
  status: 'pending' | 'routed' | 'accepted' | 'reassigned' | 'failed';
}

export interface RoutingHistoryItem {
  id: string;
  lead_id: string;
  assigned_to: string;
  assigned_by?: string;
  routing_reason: string;
  assignment_reason?: string;
  routed_at: string;
  status: string;
}

export interface AgentCapacity {
  agent_id: string;
  agent_name: string;
  current_leads: number;
  max_capacity: number;
  capacity_percentage: number;
  avg_response_time_hours?: number;
}

export interface ManualRoutingRequest {
  leadId: string;
  workspaceId: string;
  assignedTo?: string;
  reason?: string;
}

/**
 * Get routing history for a lead
 */
export function useLeadRouting(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'routing', 'history', leadId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/routing/history/${leadId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch routing history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.history as RoutingHistoryItem[];
    },
    enabled: !!leadId && !!workspaceId,
  });
}

/**
 * Get current routing assignment for a lead
 */
export function useCurrentRouting(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'routing', 'current', leadId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/routing/history/${leadId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch routing: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if response contains an error (API returns 200 with error object)
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      const history = data.history as RoutingHistoryItem[];
      return history.length > 0 ? history[0] : null;
    },
    enabled: !!leadId && !!workspaceId,
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Get agent capacity for workspace
 */
export function useAgentCapacity(workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'routing', 'agents', 'capacity', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/routing/agents/capacity?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch agent capacity: ${response.statusText}`);
      }

      const data = await response.json();
      return data.agents as AgentCapacity[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Trigger manual routing for a lead
 */
export function useManualRouting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ManualRoutingRequest) => {
      const { leadId, workspaceId, assignedTo, reason } = request;

      const response = await fetch(
        `/api/v1/crm/routing/leads/${leadId}?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo, reason }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to route lead');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Lead Routed', { description: 'The lead has been assigned successfully.' });

      // Invalidate routing history
      queryClient.invalidateQueries({
        queryKey: ['crm', 'routing', 'history', variables.leadId, variables.workspaceId],
      });

      // Invalidate current routing
      queryClient.invalidateQueries({
        queryKey: ['crm', 'routing', 'current', variables.leadId, variables.workspaceId],
      });

      // Invalidate agent capacity
      queryClient.invalidateQueries({
        queryKey: ['crm', 'routing', 'agents', 'capacity', variables.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error('Routing Failed', { description: error.message });
    },
  });
}

/**
 * Get routing status color for UI
 */
export function getRoutingStatusColor(
  status: 'pending' | 'routed' | 'accepted' | 'reassigned' | 'failed'
): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'routed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'reassigned':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  }
}

/**
 * Get capacity utilization color
 */
export function getCapacityColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600 dark:text-red-400';
  if (percentage >= 75) return 'text-orange-600 dark:text-orange-400';
  if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}
