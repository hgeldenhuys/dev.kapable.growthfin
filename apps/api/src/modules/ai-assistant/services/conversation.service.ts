/**
 * Conversation Service
 * Business logic for managing AI conversations
 */

import { db } from '@agios/db/client';
import {
  aiConversations,
  aiMessages,
  type AiConversation,
  type AiMessage,
  type NewAiConversation,
  type NewAiMessage,
} from '@agios/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

export class ConversationService {
  /**
   * Get or create active conversation for a user in a workspace
   * Only one active conversation (clearedAt = NULL) allowed per user per workspace
   */
  static async getOrCreateConversation(
    userId: string,
    workspaceId: string
  ): Promise<AiConversation> {
    // Try to find active conversation (clearedAt is NULL)
    const [existing] = await db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.userId, userId),
          eq(aiConversations.workspaceId, workspaceId),
          isNull(aiConversations.clearedAt)
        )
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create new conversation
    const [newConversation] = await db
      .insert(aiConversations)
      .values({
        userId,
        workspaceId,
      })
      .returning();

    return newConversation;
  }

  /**
   * Get active conversation (if exists)
   */
  static async getActiveConversation(
    userId: string,
    workspaceId: string
  ): Promise<AiConversation | null> {
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.userId, userId),
          eq(aiConversations.workspaceId, workspaceId),
          isNull(aiConversations.clearedAt)
        )
      )
      .limit(1);

    return conversation || null;
  }

  /**
   * Add a message to a conversation
   */
  static async addMessage(params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    tokenUsage?: {
      input: number;
      output: number;
      total: number;
    };
    context?: any;
  }): Promise<AiMessage> {
    const [message] = await db
      .insert(aiMessages)
      .values({
        conversationId: params.conversationId,
        role: params.role,
        content: params.content,
        model: params.model,
        tokenUsage: params.tokenUsage,
        context: params.context,
      })
      .returning();

    // Update conversation's updatedAt
    await db
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, params.conversationId));

    return message;
  }

  /**
   * Get conversation history (recent messages)
   * Used to provide context to the LLM
   */
  static async getConversationHistory(
    conversationId: string,
    limit: number = 20
  ): Promise<AiMessage[]> {
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(desc(aiMessages.createdAt))
      .limit(limit);

    // Return in chronological order (oldest first)
    return messages.reverse();
  }

  /**
   * Clear conversation by setting clearedAt timestamp
   * This marks the conversation as archived
   */
  static async clearConversation(conversationId: string): Promise<void> {
    await db
      .update(aiConversations)
      .set({ clearedAt: new Date() })
      .where(eq(aiConversations.id, conversationId));
  }

  /**
   * Create a new conversation
   */
  static async createConversation(
    userId: string,
    workspaceId: string
  ): Promise<AiConversation> {
    const [conversation] = await db
      .insert(aiConversations)
      .values({
        userId,
        workspaceId,
      })
      .returning();

    return conversation;
  }

  /**
   * Get conversation with all messages
   */
  static async getConversationWithMessages(
    conversationId: string
  ): Promise<{ conversation: AiConversation; messages: AiMessage[] } | null> {
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return null;
    }

    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);

    return { conversation, messages };
  }
}
