import { useQuery } from '@tanstack/react-query';

export interface JobExecutionReport {
  job: {
    id: string;
    jobType: string;
    status: 'completed' | 'failed' | 'running';
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
  };
  summary: {
    totalEntities: number;
    successful: number;
    failed: number;
    skipped: number;
    totalCost: number;
    totalDurationMs: number;
    avgCostPerEntity: number;
    avgDurationPerEntity: number;
    totalToolCalls: number;
  };
  logs: Array<{
    id: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    email: string | null;
    entityType: 'contact' | 'lead';
    status: 'success' | 'failed' | 'skipped';
    score: number | null;
    cost: string;
    durationMs: number;
    tokensUsed: number;
    enrichmentData: Record<string, unknown>;
    reasoning: string;
    errorMessage: string | null;
    toolCalls: Array<{
      id: string;
      toolName: string;
      arguments: Record<string, unknown>;
      result: Record<string, unknown>;
      status: 'success' | 'failed';
      cost: string;
      durationMs: number;
      provider: string;
      error: string | null;
      createdAt: string;
    }>;
    processedAt: string;
  }>;
}

export function useJobReport(jobId: string | undefined, workspaceId: string) {
  return useQuery<JobExecutionReport>({
    queryKey: ['job-report', jobId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/jobs/${jobId}/report?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch job report: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!jobId && !!workspaceId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - reports don't change
  });
}
