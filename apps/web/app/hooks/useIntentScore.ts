/**
 * useIntentScore Hook
 * React hooks for AI-powered buying intent signal detection
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';


export interface IntentSignal {
  id: string;
  lead_id: string;
  signal_type: string;
  source: string;
  confidence: number;
  detected_at: string;
  signal_data?: Record<string, any>;
}

export interface IntentScore {
  lead_id: string;
  intent_score: number;
  intent_level: 'low' | 'medium' | 'high' | 'very_high';
  last_calculated_at: string;
  signals: IntentSignal[];
  recommended_action?: string;
}

export interface TopIntentLead {
  lead_id: string;
  lead_name: string;
  intent_score: number;
  intent_level: string;
  last_signal_at: string;
}

/**
 * Get intent score for a specific lead
 */
export function useIntentScore(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'intent', leadId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/intent/leads/${leadId}?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch intent score: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if response contains an error (API returns 200 with error object)
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data as IntentScore;
    },
    enabled: !!leadId && !!workspaceId,
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Get top intent leads for workspace
 */
export function useTopIntentLeads(workspaceId: string, limit: number = 10) {
  return useQuery({
    queryKey: ['crm', 'intent', 'top-leads', workspaceId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/intent/top-leads?workspaceId=${workspaceId}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch top intent leads: ${response.statusText}`);
      }

      const data = await response.json();
      return data.leads as TopIntentLead[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Get intent level color for UI
 */
export function getIntentLevelColor(level: 'low' | 'medium' | 'high' | 'very_high'): string {
  switch (level) {
    case 'low':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'medium':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'high':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'very_high':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  }
}

/**
 * Get intent score badge color based on score (0-100)
 */
export function getIntentScoreColor(score: number): string {
  if (score >= 76) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  if (score >= 51) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  if (score >= 26) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

/**
 * Get intent level label based on score
 */
export function getIntentLevelLabel(score: number): string {
  if (score >= 76) return 'Very High Intent';
  if (score >= 51) return 'High Intent';
  if (score >= 26) return 'Medium Intent';
  return 'Low Intent';
}

/**
 * Format signal type for display
 */
export function formatSignalType(signalType: string): string {
  return signalType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get signal icon name (for lucide-react)
 */
export function getSignalIcon(signalType: string): string {
  const iconMap: Record<string, string> = {
    'website_visit': 'Globe',
    'email_open': 'Mail',
    'email_click': 'MousePointer',
    'form_submission': 'FileText',
    'demo_request': 'Video',
    'pricing_page_view': 'DollarSign',
    'content_download': 'Download',
    'repeat_visit': 'RefreshCw',
    'feature_page_view': 'Layers',
    'contact_attempt': 'Phone',
  };

  return iconMap[signalType] || 'Activity';
}
