/**
 * US-AI-013: Global Chat State Management
 * TanStack Query hooks for AI Assistant API state
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from './useRouteContext';
import { useDriverTour } from './useDriverTour';
import {
  fetchConversation,
  sendAIMessage,
  clearAIConversation,
  type AIMessage,
  type AIConversation,
} from '../../lib/api/ai-assistant';
import { toast } from 'sonner';

export interface UseAIChatOptions {
  workspaceId: string;
  userId: string;
}

export interface UseAIChatReturn {
  messages: AIMessage[];
  conversation: AIConversation | null | undefined;
  isLoading: boolean;
  isSending: boolean;
  sendMessage: (message: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  refetch: () => void;
}

/**
 * Hook for managing AI chat conversations
 * Combines TanStack Query for API state with route context
 */
export function useAIChat({ workspaceId, userId }: UseAIChatOptions): UseAIChatReturn {
  const queryClient = useQueryClient();
  const routeContext = useRouteContext();
  const { executeActions } = useDriverTour();

  // Get conversation with messages
  const {
    data: conversation,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['ai-conversation', workspaceId, userId],
    queryFn: () => fetchConversation(workspaceId, userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry 404s - they mean no conversation exists
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return sendAIMessage(workspaceId, userId, {
        message,
        context: {
          userId,
          ...routeContext,
        },
      });
    },
    onSuccess: (data) => {
      // Invalidate and refetch conversation
      queryClient.invalidateQueries({ queryKey: ['ai-conversation', workspaceId, userId] });
      // Execute any Driver.js actions from the AI response
      if (data?.driver_actions?.length) {
        executeActions(data.driver_actions);
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to send message', {
        description: error.message,
      });
    },
  });

  // Clear conversation mutation
  const clearConversationMutation = useMutation({
    mutationFn: () => clearAIConversation(workspaceId, userId),
    onSuccess: () => {
      // Invalidate and refetch conversation
      queryClient.invalidateQueries({ queryKey: ['ai-conversation', workspaceId, userId] });
      toast.success('Conversation cleared');
    },
    onError: (error: Error) => {
      toast.error('Failed to clear conversation', {
        description: error.message,
      });
    },
  });

  return {
    messages: conversation?.messages ?? [],
    conversation,
    isLoading,
    isSending: sendMessageMutation.isPending,
    sendMessage: async (message: string) => {
      await sendMessageMutation.mutateAsync(message);
    },
    clearConversation: async () => {
      await clearConversationMutation.mutateAsync();
    },
    refetch: () => {
      refetch();
    },
  };
}
