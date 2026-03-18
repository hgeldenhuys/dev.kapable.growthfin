import { useQuery } from '@tanstack/react-query';

interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  status: 'success' | 'failed';
  durationMs: number | null;
  createdAt: string;
  provider: string | null;
}

interface UseToolCallsResponse {
  toolCalls: ToolCall[];
}

export function useToolCalls(leadId: string, workspaceId: string, options?: { pollingInterval?: number }) {
  return useQuery<UseToolCallsResponse>({
    queryKey: ['crm', 'leads', leadId, 'tool-calls', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/tool-calls?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch tool calls');
      }
      return response.json();
    },
    enabled: !!leadId && !!workspaceId,
    refetchInterval: options?.pollingInterval || false,
  });
}
