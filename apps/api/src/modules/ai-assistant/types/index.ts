/**
 * AI Assistant Types
 * Shared TypeScript types for AI assistant module
 */

export interface RouteContext {
  currentRoute: string;
  routeParams: Record<string, string>;
  userId: string;
  workspaceId: string;
  additionalContext?: any;
}

export interface MessageWithContext {
  message: string;
  context: RouteContext;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface ConversationResponse {
  id: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  id: string;
  conversationId: string;
  role: 'assistant';
  content: string;
  createdAt: string;
  model: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface ClearConversationResponse {
  success: boolean;
  newConversationId: string;
}

export interface AIConfigResponse {
  id: string;
  workspaceId: string;
  model: string;
  maxTokens: number;
  temperature: number;
  createdAt: string;
  updatedAt: string;
}
