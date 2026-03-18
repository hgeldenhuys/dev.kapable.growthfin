/**
 * Assistant Chat Types
 */

export interface ChatRequest {
  conversationId: string;
  message: string;
}

export interface ChatStreamChunk {
  type: 'content' | 'error' | 'done';
  content?: string;
  error?: string;
}

export interface ConversationWithMessages {
  id: string;
  projectId: string | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
  }>;
}

export interface ConversationListItem {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessagePreview: string;
}
