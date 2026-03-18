/**
 * useLeadImport Hook
 * Hook for managing CSV lead imports
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { useEffect, useState } from 'react';


interface ImportStatus {
  import_id: string;
  status: 'validating' | 'importing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
  imported_rows: number;
  error_rows: number;
  error_file_url?: string;
  started_at?: string;
  completed_at?: string;
  list_id?: string; // ID of the created list
}

/**
 * Get import status with SSE updates
 */
export function useImportStatus(importId: string, workspaceId: string) {
  const [sseData, setSSEData] = useState<ImportStatus | null>(null);

  // Initial fetch
  const query = useQuery({
    queryKey: ['crm', 'leads', 'imports', importId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/leads/imports/${importId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch import status: ${response.statusText}`);
      }
      return response.json() as Promise<ImportStatus>;
    },
    enabled: !!importId && !!workspaceId,
    refetchInterval: (data) => {
      // Poll every 2 seconds if not complete
      if (data && (data.status === 'validating' || data.status === 'importing')) {
        return 2000;
      }
      return false;
    },
  });

  // SSE for real-time updates
  useEffect(() => {
    if (!importId || !workspaceId) return;

    // Use relative URL so SSE goes through the same-origin proxy (api.v1.$.ts)
    const eventSource = new EventSource(
      `/api/v1/crm/leads/imports/${importId}/stream?workspaceId=${workspaceId}`
    );

    let isCompleted = false;

    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data) as ImportStatus;
        setSSEData(data);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    });

    // Handle completion event
    eventSource.addEventListener('completed', (event) => {
      try {
        const data = JSON.parse(event.data) as ImportStatus;
        setSSEData({ ...data, status: 'completed' });
        isCompleted = true;
        eventSource.close();
      } catch (error) {
        console.error('Failed to parse completion data:', error);
      }
    });

    // Handle failure event
    eventSource.addEventListener('failed', (event) => {
      try {
        const data = JSON.parse(event.data) as ImportStatus;
        setSSEData({ ...data, status: 'failed' });
        isCompleted = true;
        eventSource.close();
      } catch (error) {
        console.error('Failed to parse failure data:', error);
      }
    });

    eventSource.addEventListener('error', (error) => {
      // Only log error if the import hasn't completed successfully
      // (connection close after completion triggers error event, which is expected)
      if (!isCompleted) {
        console.error('SSE error:', error);
      }
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [importId, workspaceId]);

  // Return SSE data if available, otherwise query data
  return {
    ...query,
    data: sseData || query.data,
  };
}

/**
 * Upload CSV and start import
 */
export async function uploadAndImportCSV({
  workspaceId,
  userId,
  file,
  columnMapping,
  duplicateStrategy,
  validationMode,
  phonePrefix,
  mergeStrategy,
}: {
  workspaceId: string;
  userId: string;
  file: File;
  columnMapping: Record<string, string>;
  duplicateStrategy: 'skip' | 'update' | 'create';
  validationMode: 'strict' | 'lenient';
  phonePrefix?: string;
  mergeStrategy?: 'merge' | 'replace';
}): Promise<{ import_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('column_mapping', JSON.stringify(columnMapping));
  formData.append('duplicate_strategy', duplicateStrategy);
  formData.append('validation_mode', validationMode);
  formData.append('workspaceId', workspaceId);
  formData.append('userId', userId);
  if (phonePrefix) {
    formData.append('phone_prefix', phonePrefix);
  }
  if (mergeStrategy) {
    formData.append('merge_strategy', mergeStrategy);
  }

  const response = await fetch(
    `/api/v1/crm/leads/import`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to upload CSV');
  }

  return response.json();
}

/**
 * Download error report
 */
export async function downloadErrorReport(
  importId: string,
  workspaceId: string
): Promise<void> {
  const response = await fetch(
    `/api/v1/crm/leads/imports/${importId}/errors?workspaceId=${workspaceId}`
  );

  if (!response.ok) {
    throw new Error('Failed to download error report');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-errors-${importId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
