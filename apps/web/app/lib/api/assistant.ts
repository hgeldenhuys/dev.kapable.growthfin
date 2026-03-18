/**
 * AI Assistant API Client
 * Functions for managing conversations and streaming chat messages
 */

const API_URL = typeof window !== 'undefined'
  ? (window as any).ENV?.API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

export interface Conversation {
  id: string;
  workspaceId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface StreamEvent {
  type: 'start' | 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface ParsedMessage {
  thinkingContent: string;
  answerContent: string;
  fullContent: string;
}

/**
 * Parse streaming response to extract thinking blocks
 * Thinking blocks are enclosed in <thinking>...</thinking> tags
 */
export function parseStreamingResponse(accumulatedContent: string): ParsedMessage {
  // Extract thinking block
  const thinkingMatch = accumulatedContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinkingContent = thinkingMatch && thinkingMatch[1] ? thinkingMatch[1].trim() : '';

  // Extract answer (everything after </thinking> or entire content if no thinking block)
  const answerContent = thinkingMatch
    ? accumulatedContent.substring(accumulatedContent.indexOf('</thinking>') + 11).trim()
    : accumulatedContent;

  return {
    thinkingContent,
    answerContent,
    fullContent: accumulatedContent,
  };
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  systemPrompt: string;
}

/**
 * Create a new conversation
 */
export async function createConversation(workspaceId: string): Promise<Conversation> {
  const res = await fetch(`${API_URL}/api/v1/assistant/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create conversation: ${error}`);
  }

  const data = await res.json();
  return data.conversation;
}

/**
 * Fetch conversation with messages
 */
export async function fetchConversation(conversationId: string): Promise<ConversationWithMessages> {
  const res = await fetch(`${API_URL}/api/v1/assistant/conversations/${conversationId}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch conversation: ${error}`);
  }

  const data = await res.json();
  return data.conversation;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/assistant/conversations/${conversationId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete conversation: ${error}`);
  }
}

/**
 * Fetch available LLM models for a workspace
 */
export async function fetchAvailableModels(workspaceId: string): Promise<LLMModel[]> {
  const res = await fetch(`${API_URL}/api/v1/assistant/models?workspaceId=${workspaceId}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch models: ${error}`);
  }

  const data = await res.json();
  return data.models;
}

/**
 * Stream chat messages using Server-Sent Events
 * Yields stream events as they arrive
 */
export async function* streamChat(
  conversationId: string,
  message: string,
  model?: string,
  extendedThinking?: boolean
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_URL}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, model, extended_thinking: extendedThinking }),
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send message: ${error}`);
  }

  if (!res.body) {
    throw new Error('Response body is null');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data as StreamEvent;
          } catch (e) {
            console.error('Failed to parse SSE data:', line, e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
