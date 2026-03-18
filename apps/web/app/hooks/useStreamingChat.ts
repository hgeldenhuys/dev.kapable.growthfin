/**
 * useStreamingChat Hook
 * Handles SSE streaming for chat messages
 */

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamChat, parseStreamingResponse, type Message } from '~/lib/api/assistant';

export function useStreamingChat(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const [streamingMessage, setStreamingMessage] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (message: string, model?: string, extendedThinking?: boolean) => {
    if (!conversationId) {
      throw new Error('No conversation ID');
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      setIsStreaming(true);
      setStreamingMessage(''); // Start with empty streaming message

      // Add user message optimistically
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData(['conversation', conversationId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...(old.messages || []), userMessage],
        };
      });

      // Stream response
      let accumulatedContent = '';
      let assistantMessageId: string | undefined;

      for await (const event of streamChat(conversationId, message, model, extendedThinking)) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        if (event.type === 'content') {
          accumulatedContent += event.content || '';
          setStreamingMessage(accumulatedContent);
        } else if (event.type === 'done') {
          // Parse thinking blocks from accumulated content
          const parsed = parseStreamingResponse(accumulatedContent);

          // Stream complete - add assistant message to conversation
          assistantMessageId = `assistant-${Date.now()}`;
          const assistantMessage: Message = {
            id: assistantMessageId,
            conversationId,
            role: 'assistant',
            content: parsed.answerContent,
            thinkingContent: parsed.thinkingContent || undefined,
            createdAt: new Date().toISOString(),
          };

          queryClient.setQueryData(['conversation', conversationId], (old: any) => {
            if (!old) return old;
            return {
              ...old,
              messages: [...(old.messages || []), assistantMessage],
            };
          });

          setStreamingMessage(undefined);
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Stream error');
        }
      }

      // Refetch to get actual messages from server
      await queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });
    } catch (error) {
      setStreamingMessage(undefined);
      throw error;
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const cancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingMessage(undefined);
    }
  };

  return {
    streamingMessage,
    isStreaming,
    sendMessage,
    cancelStreaming,
  };
}
