/**
 * Context Manager Service
 * Tracks token usage, manages context budget, and handles conversation compression
 */

import { db } from '@agios/db';
import { aiMessages, aiConversations } from '@agios/db/schema';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import { encode } from 'gpt-tokenizer';
import { SummarizationService } from './summarization.service';

export interface ContextBudget {
  used: number;
  limit: number;
  percentage: number;
  breakdown: {
    messages: number;
    files: number;
    tools: number;
    other: number;
  };
  shouldCompress: boolean;
}

export interface CompressionResult {
  summarized: number;
  tokensSaved: number;
  newTokenCount: number;
}

export class ContextManagerService {
  private static readonly TOKEN_LIMIT = 200000;
  private static readonly COMPRESSION_THRESHOLD = 0.9; // 90%
  private static readonly KEEP_RECENT_COUNT = 10; // Keep last 10 messages
  private static readonly COMPRESSION_MIN_AGE = 20; // Compress messages older than 20 turns

  /**
   * Count tokens in text using GPT tokenizer
   */
  static countTokens(text: string): number {
    if (!text) return 0;
    try {
      return encode(text).length;
    } catch (error) {
      // Fallback: rough estimation (4 chars per token)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Get current context budget for a conversation
   */
  static async getContextBudget(conversationId: string): Promise<ContextBudget> {
    // Get all messages in conversation
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));

    // Count tokens by category
    let messageTokens = 0;
    let fileTokens = 0;
    let toolTokens = 0;
    let otherTokens = 0;

    for (const message of messages) {
      const content = message.content;
      const tokens = this.countTokens(content);
      const metadata = message.metadata as any;

      // Categorize based on message metadata and content
      if (message.role === 'user' || message.role === 'assistant') {
        // Check if message contains file content (code blocks or file read markers)
        if (content.includes('```') || metadata?.type === 'file_read') {
          fileTokens += tokens;
        }
        // Check if message is tool result
        else if (metadata?.type === 'tool_result' || metadata?.tool_name) {
          toolTokens += tokens;
        }
        // Regular conversation message
        else {
          messageTokens += tokens;
        }
      } else if (message.role === 'system') {
        // System messages (compression summaries, etc.)
        if (metadata?.type === 'compression_summary') {
          otherTokens += tokens;
        } else {
          messageTokens += tokens;
        }
      } else {
        otherTokens += tokens;
      }
    }

    const totalUsed = messageTokens + fileTokens + toolTokens + otherTokens;
    const percentage = totalUsed / this.TOKEN_LIMIT;

    return {
      used: totalUsed,
      limit: this.TOKEN_LIMIT,
      percentage,
      breakdown: {
        messages: messageTokens,
        files: fileTokens,
        tools: toolTokens,
        other: otherTokens,
      },
      shouldCompress: percentage >= this.COMPRESSION_THRESHOLD,
    };
  }

  /**
   * Track message tokens - updates message metadata with token count
   */
  static async trackMessageTokens(
    messageId: string,
    content: string
  ): Promise<number> {
    const tokens = this.countTokens(content);

    // Update message with token count in metadata
    await db
      .update(aiMessages)
      .set({
        metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tokens}', ${tokens}::text::jsonb)`,
      })
      .where(eq(aiMessages.id, messageId));

    return tokens;
  }

  /**
   * Check if conversation should be compressed
   */
  static async shouldCompress(conversationId: string): Promise<boolean> {
    const budget = await this.getContextBudget(conversationId);
    return budget.shouldCompress;
  }

  /**
   * Compress conversation by summarizing old messages
   */
  static async compressConversation(
    conversationId: string,
    options: {
      keepRecentCount?: number;
      forceSummarize?: boolean;
    } = {}
  ): Promise<CompressionResult> {
    const { keepRecentCount = this.KEEP_RECENT_COUNT, forceSummarize = false } = options;

    // Check if compression needed
    if (!forceSummarize) {
      const budget = await this.getContextBudget(conversationId);
      if (!budget.shouldCompress) {
        return {
          summarized: 0,
          tokensSaved: 0,
          newTokenCount: budget.used,
        };
      }
    }

    // Get all messages
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));

    // Keep recent messages
    const recentMessages = messages.slice(-keepRecentCount);
    const oldMessages = messages.slice(0, -keepRecentCount);

    if (oldMessages.length === 0) {
      return {
        summarized: 0,
        tokensSaved: 0,
        newTokenCount: messages.reduce((sum, m) => sum + this.countTokens(m.content), 0),
      };
    }

    // Get workspace ID from conversation
    const conversation = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);

    if (!conversation[0]) {
      throw new Error('Conversation not found');
    }

    // Generate summary of old messages
    const summary = await SummarizationService.summarizeConversation(
      conversation[0].workspaceId,
      oldMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content.length > 1000 ? m.content.substring(0, 1000) + '...' : m.content,
        timestamp: m.createdAt,
      })),
      1000 // maxChars
    );

    // Calculate tokens before compression
    const tokensBefore = oldMessages.reduce((sum, m) => sum + this.countTokens(m.content), 0);
    const tokensAfter = this.countTokens(summary.summary);
    const tokensSaved = tokensBefore - tokensAfter;

    // Create summary message
    await db.insert(aiMessages).values({
      conversationId,
      role: 'system',
      content: `[CONVERSATION SUMMARY]\n\n${summary.summary}\n\n` +
        `Topics: ${summary.topics.join(', ')}\n` +
        `Decisions: ${summary.decisions?.join('; ') || 'None'}\n\n` +
        `[Original messages from ${oldMessages[0].createdAt?.toISOString()} to ${oldMessages[oldMessages.length - 1].createdAt?.toISOString()} summarized]`,
      metadata: {
        type: 'compression_summary',
        originalMessageCount: oldMessages.length,
        tokensSaved,
        topics: summary.topics,
        decisions: summary.decisions,
        compressed: true,
      },
    });

    // Mark old messages as compressed (clear content to save space)
    for (const message of oldMessages) {
      await db
        .update(aiMessages)
        .set({
          metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{compressed}', 'true'::jsonb)`,
          content: '', // Clear content to save space
        })
        .where(eq(aiMessages.id, message.id));
    }

    // Calculate new token count
    const newTokenCount =
      tokensAfter + recentMessages.reduce((sum, m) => sum + this.countTokens(m.content), 0);

    return {
      summarized: oldMessages.length,
      tokensSaved,
      newTokenCount,
    };
  }

  /**
   * Auto-compress conversation if needed
   */
  static async autoCompress(conversationId: string): Promise<boolean> {
    const shouldCompress = await this.shouldCompress(conversationId);

    if (shouldCompress) {
      await this.compressConversation(conversationId);
      return true;
    }

    return false;
  }

  /**
   * Get compression history for a conversation
   */
  static async getCompressionHistory(conversationId: string): Promise<
    Array<{
      timestamp: Date;
      messageCount: number;
      tokensSaved: number;
      topics: string[];
    }>
  > {
    const summaryMessages = await db
      .select()
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages.conversationId, conversationId),
          eq(aiMessages.role, 'system')
        )
      )
      .orderBy(desc(aiMessages.createdAt));

    return summaryMessages
      .filter((m) => {
        const metadata = m.metadata as any;
        return metadata?.type === 'compression_summary';
      })
      .map((m) => {
        const metadata = m.metadata as any;
        return {
          timestamp: m.createdAt || new Date(),
          messageCount: metadata.originalMessageCount || 0,
          tokensSaved: metadata.tokensSaved || 0,
          topics: metadata.topics || [],
        };
      });
  }

  /**
   * Calculate tokens for multiple messages
   */
  static calculateTotalTokens(messages: Array<{ content: string }>): number {
    return messages.reduce((total, message) => total + this.countTokens(message.content), 0);
  }

  /**
   * Estimate token savings from compression
   */
  static async estimateCompressionSavings(
    conversationId: string,
    keepRecentCount: number = this.KEEP_RECENT_COUNT
  ): Promise<{
    currentTokens: number;
    estimatedAfterCompression: number;
    potentialSavings: number;
    compressionRatio: number;
  }> {
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));

    const oldMessages = messages.slice(0, -keepRecentCount);
    const recentMessages = messages.slice(-keepRecentCount);

    const currentTokens = this.calculateTotalTokens(messages);
    const oldTokens = this.calculateTotalTokens(oldMessages);
    const recentTokens = this.calculateTotalTokens(recentMessages);

    // Assume 70% compression ratio (typical for conversation summaries)
    const estimatedSummaryTokens = Math.ceil(oldTokens * 0.3);
    const estimatedAfterCompression = estimatedSummaryTokens + recentTokens;
    const potentialSavings = currentTokens - estimatedAfterCompression;
    const compressionRatio = currentTokens > 0 ? potentialSavings / currentTokens : 0;

    return {
      currentTokens,
      estimatedAfterCompression,
      potentialSavings,
      compressionRatio,
    };
  }
}
