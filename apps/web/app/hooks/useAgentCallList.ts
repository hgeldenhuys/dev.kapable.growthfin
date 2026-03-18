/**
 * useAgentCallList Hook
 * Fetch agent's priority call list with filters
 */

import { useQuery } from '@tanstack/react-query';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface CallListFilters {
  status?: 'new' | 'contacted' | 'qualified' | 'callback';
  campaignId?: string;
  minScore?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AgentCallListLead {
  id: string;
  contact: {
    firstName: string;
    lastName: string;
    title: string | null;
    phone: string | null;
    email: string | null;
  };
  account: {
    name: string;
    industry: string | null;
    employeeCount: number | null;
  };
  status: 'new' | 'contacted' | 'qualified' | 'callback';
  propensityScore: number | null;
  callbackDate: string | null;
  lastContactDate: string | null;
  lastActivity: {
    type: string;
    disposition: string;
    createdAt: string;
  } | null;
  campaignName: string;
}

export interface AgentCallListResponse {
  leads: AgentCallListLead[];
  total: number;
}

interface UseAgentCallListOptions {
  workspaceId: string;
  userId: string;
  filters?: CallListFilters;
  enabled?: boolean;
}

/**
 * Fetch agent's priority call list with filters
 */
export function useAgentCallList({
  workspaceId,
  userId,
  filters = {},
  enabled = true
}: UseAgentCallListOptions) {
  return useQuery({
    queryKey: ['crm', 'agent', 'call-list', workspaceId, userId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('workspaceId', workspaceId);
      params.set('userId', userId);

      if (filters.status) params.set('status', filters.status);
      if (filters.campaignId) params.set('campaignId', filters.campaignId);
      if (filters.minScore !== undefined) params.set('minScore', filters.minScore.toString());
      if (filters.search) params.set('search', filters.search);
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.offset) params.set('offset', filters.offset.toString());

      const url = `/api/v1/crm/agent/call-list?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch call list');
      }

      return response.json() as Promise<AgentCallListResponse>;
    },
    enabled: enabled && !!workspaceId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
