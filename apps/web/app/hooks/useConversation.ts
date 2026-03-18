/**
 * useConversation Hook
 * Manages conversation lifecycle with TanStack Query
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createConversation,
  fetchConversation,
  deleteConversation,
  type Message,
  type Conversation,
} from '~/lib/api/assistant';

const CONVERSATION_STORAGE_KEY = 'agios-chat-conversation-id';

export function useConversation(workspaceId: string) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(() => {
    // Try to get conversation ID from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CONVERSATION_STORAGE_KEY);
    }
    return null;
  });

  // Fetch conversation data
  const {
    data: conversationData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => fetchConversation(conversationId!),
    enabled: !!conversationId,
    staleTime: 0, // Always fetch fresh data
  });

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: () => createConversation(workspaceId),
    onSuccess: (data) => {
      setConversationId(data.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, data.id);
      }
      queryClient.setQueryData(['conversation', data.id], {
        ...data,
        messages: [],
      });
    },
  });

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      }
      queryClient.removeQueries({ queryKey: ['conversation', conversationId] });
    },
  });

  // Create initial conversation if none exists
  useEffect(() => {
    if (!conversationId && !createMutation.isPending) {
      createMutation.mutate();
    }
  }, [conversationId, createMutation.isPending]);

  // Add optimistic message update
  const addOptimisticMessage = (message: Message) => {
    if (!conversationId) return;

    queryClient.setQueryData(['conversation', conversationId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        messages: [...(old.messages || []), message],
      };
    });
  };

  const deleteAndCreateNew = async () => {
    if (conversationId) {
      await deleteMutation.mutateAsync(conversationId);
    }
    const newConversation = await createMutation.mutateAsync();
    return newConversation;
  };

  return {
    conversation: conversationData as Conversation | undefined,
    messages: (conversationData?.messages || []) as Message[],
    isLoading: isLoading || createMutation.isPending,
    error,
    createNew: createMutation.mutate,
    deleteAndCreateNew,
    addOptimisticMessage,
  };
}
