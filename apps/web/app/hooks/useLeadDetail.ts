/**
 * useLeadDetail Hook
 * Fetch complete lead detail with all context for screen pop
 */

import { useQuery } from '@tanstack/react-query';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface LeadDetailContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  address: string | null;
}

export interface LeadDetailAccount {
  id: string;
  name: string;
  industry: string | null;
  employeeCount: number | null;
  website: string | null;
  revenue: string | null;
  description: string | null;
}

export interface LeadDetailCampaign {
  id: string;
  name: string;
  messagingStrategy: string | null;
}

export interface LeadDetailAIIntelligence {
  propensityScore: number;
  scoreBreakdown: any; // ScoreBreakdown type from scoring service
  scoreUpdatedAt: string | null;
  scoreFactors: Array<{
    factor: string;
    weight: number;
  }>;
  businessIntelligence: string;
}

/**
 * H.4 - Recording metadata for call activities
 */
export interface ActivityRecording {
  sid: string;
  url: string;
  duration: number;
  status: string;
  recordedAt: string;
}

/**
 * H.4 - Transcription data for call activities
 */
export interface ActivityTranscription {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  language?: string;
  languageConfidence?: number;
  speakers?: Array<{
    speakerId: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
  processedAt?: string;
  error?: string;
}

export interface LeadDetailActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  disposition: string | null;
  notes: string | null;
  duration: number | null;
  createdAt: string;
  createdBy: string;
  /** H.4 - Call recording data */
  recording?: ActivityRecording | null;
  /** H.4 - Call transcription data */
  transcription?: ActivityTranscription | null;
}

export interface LeadDetailRelatedContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  department: string | null;
  phone: string | null;
  lastContactDate: string | null;
}

export interface LeadDetailResponse {
  lead: {
    id: string;
    status: string;
    createdAt: string;
  };
  contact: LeadDetailContact;
  account: LeadDetailAccount;
  campaign: LeadDetailCampaign;
  aiIntelligence: LeadDetailAIIntelligence;
  recentActivities: LeadDetailActivity[];
  relatedContacts: LeadDetailRelatedContact[];
}

interface UseLeadDetailOptions {
  leadId: string | null;
  workspaceId: string;
  userId: string;
  enabled?: boolean;
}

/**
 * Fetch complete lead detail for screen pop
 */
export function useLeadDetail({
  leadId,
  workspaceId,
  userId,
  enabled = true
}: UseLeadDetailOptions) {
  return useQuery({
    queryKey: ['crm', 'agent', 'leads', leadId, 'detail', workspaceId, userId],
    queryFn: async () => {
      if (!leadId) {
        throw new Error('Lead ID is required');
      }

      const url = `/api/v1/crm/agent/leads/${leadId}/detail?workspaceId=${workspaceId}&userId=${userId}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch lead detail');
      }

      return response.json() as Promise<LeadDetailResponse>;
    },
    enabled: enabled && !!leadId && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
