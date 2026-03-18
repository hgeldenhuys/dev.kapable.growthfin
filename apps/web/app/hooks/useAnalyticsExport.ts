/**
 * useAnalyticsExport Hook
 * Handle analytics export workflow (initiate + poll status)
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ExportType } from '~/components/crm/analytics/ExportDialog';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface ExportJobResponse {
  jobId: string;
  status: 'pending';
  downloadUrl: null;
}

export interface ExportStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
}

/**
 * Hook for initiating and polling analytics exports
 */
export function useAnalyticsExport(workspaceId: string, campaignId?: string) {
  /**
   * Initiate an export job
   */
  const initiateExport = useCallback(
    async (exportType: ExportType): Promise<{ jobId: string }> => {
      try {
        const response = await fetch(
          `/api/v1/crm/analytics/export?workspaceId=${workspaceId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...(campaignId ? { campaignId } : {}),
              exportType,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          toast.error('Error', { description: errorText || 'Failed to start export' });
          throw new Error(errorText || 'Failed to start export');
        }

        const data: ExportJobResponse = await response.json();
        return { jobId: data.jobId };
      } catch (error) {
        toast.error('Export Failed', { description: error instanceof Error ? error.message : 'Unknown error' });
        throw error;
      }
    },
    [workspaceId, campaignId]
  );

  /**
   * Poll export job status
   */
  const pollStatus = useCallback(
    async (jobId: string): Promise<ExportStatusResponse> => {
      try {
        const response = await fetch(
          `/api/v1/crm/analytics/export/${jobId}/status?workspaceId=${workspaceId}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to check export status');
        }

        const data: ExportStatusResponse = await response.json();
        return data;
      } catch (error) {
        toast.error('Status Check Failed', { description: error instanceof Error ? error.message : 'Unknown error' });
        throw error;
      }
    },
    [workspaceId]
  );

  return {
    initiateExport,
    pollStatus,
    pollExportStatus: pollStatus,
  };
}
