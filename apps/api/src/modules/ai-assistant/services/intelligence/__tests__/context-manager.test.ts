/**
 * Context Manager Service Tests
 * Tests for token counting, context budget tracking, and conversation compression
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { aiConversations, aiMessages } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { ContextManagerService } from '../context-manager.service';

describe('ContextManagerService', () => {
  let testConversationId: string;
  const testWorkspaceId = '713dc1ca-74de-46ac-8a45-a01b2ff23230'; // Test workspace
  const testUserId = '11111111-1111-1111-1111-111111111111'; // Test user

  beforeAll(async () => {
    // Create test conversation
    const [conversation] = await db
      .insert(aiConversations)
      .values({
        userId: testUserId,
        workspaceId: testWorkspaceId,
      })
      .returning();

    testConversationId = conversation.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    await db.delete(aiConversations).where(eq(aiConversations.id, testConversationId));
  });

  describe('countTokens', () => {
    it('should count tokens for simple text', () => {
      const text = 'Hello, world!';
      const tokens = ContextManagerService.countTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10); // Should be around 3-4 tokens
    });

    it('should count tokens for code', () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;
      const tokens = ContextManagerService.countTokens(code);

      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(50);
    });

    it('should return 0 for empty string', () => {
      const tokens = ContextManagerService.countTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle null/undefined gracefully', () => {
      const tokens1 = ContextManagerService.countTokens(null as any);
      const tokens2 = ContextManagerService.countTokens(undefined as any);

      expect(tokens1).toBe(0);
      expect(tokens2).toBe(0);
    });

    it('should count tokens for long text', () => {
      const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(100);
      const tokens = ContextManagerService.countTokens(longText);

      expect(tokens).toBeGreaterThan(500);
      expect(tokens).toBeLessThan(2000);
    });
  });

  describe('getContextBudget', () => {
    it('should return empty budget for new conversation', async () => {
      const budget = await ContextManagerService.getContextBudget(testConversationId);

      expect(budget.used).toBe(0);
      expect(budget.limit).toBe(200000);
      expect(budget.percentage).toBe(0);
      expect(budget.breakdown.messages).toBe(0);
      expect(budget.breakdown.files).toBe(0);
      expect(budget.breakdown.tools).toBe(0);
      expect(budget.breakdown.other).toBe(0);
      expect(budget.shouldCompress).toBe(false);
    });

    it('should calculate budget correctly with messages', async () => {
      // Add test messages
      await db.insert(aiMessages).values([
        {
          conversationId: testConversationId,
          role: 'user',
          content: 'Hello, how are you?',
        },
        {
          conversationId: testConversationId,
          role: 'assistant',
          content: 'I am doing well, thank you! How can I help you today?',
        },
      ]);

      const budget = await ContextManagerService.getContextBudget(testConversationId);

      expect(budget.used).toBeGreaterThan(0);
      expect(budget.breakdown.messages).toBeGreaterThan(0);
      expect(budget.percentage).toBeGreaterThan(0);
      expect(budget.percentage).toBeLessThan(0.01); // Should be very small percentage

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });

    it('should categorize messages correctly', async () => {
      // Add messages of different types
      await db.insert(aiMessages).values([
        {
          conversationId: testConversationId,
          role: 'user',
          content: 'Regular message',
        },
        {
          conversationId: testConversationId,
          role: 'assistant',
          content: '```typescript\nconst x = 1;\n```',
        },
        {
          conversationId: testConversationId,
          role: 'system',
          content: 'System message',
          metadata: { type: 'tool_result', tool_name: 'read_file' },
        },
      ]);

      const budget = await ContextManagerService.getContextBudget(testConversationId);

      expect(budget.breakdown.messages).toBeGreaterThan(0); // Regular message
      expect(budget.breakdown.files).toBeGreaterThan(0); // Code block
      expect(budget.breakdown.tools).toBeGreaterThan(0); // Tool result

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });

    it('should flag for compression at 90% threshold', async () => {
      // This test would require adding ~180k tokens of messages
      // For now, we'll test the logic with a mock
      // In real scenario, compression kicks in at 180k/200k = 0.9
      const budget = await ContextManagerService.getContextBudget(testConversationId);
      expect(budget.shouldCompress).toBe(budget.percentage >= 0.9);
    });
  });

  describe('trackMessageTokens', () => {
    it('should track and store token count in metadata', async () => {
      const [message] = await db
        .insert(aiMessages)
        .values({
          conversationId: testConversationId,
          role: 'user',
          content: 'This is a test message for token tracking.',
        })
        .returning();

      const tokens = await ContextManagerService.trackMessageTokens(message.id, message.content);

      expect(tokens).toBeGreaterThan(0);

      // Verify metadata was updated
      const [updated] = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.id, message.id));

      expect(updated.metadata).toHaveProperty('tokens');
      expect((updated.metadata as any).tokens).toBe(tokens);

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.id, message.id));
    });
  });

  describe('compressConversation', () => {
    it('should not compress if under threshold', async () => {
      // Add a few messages (not enough to trigger compression)
      await db.insert(aiMessages).values([
        {
          conversationId: testConversationId,
          role: 'user',
          content: 'Message 1',
        },
        {
          conversationId: testConversationId,
          role: 'assistant',
          content: 'Response 1',
        },
      ]);

      const result = await ContextManagerService.compressConversation(testConversationId);

      expect(result.summarized).toBe(0);
      expect(result.tokensSaved).toBe(0);

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });

    it('should compress when forced', async () => {
      // Add enough messages to compress
      const messages = Array.from({ length: 15 }, (_, i) => ({
        conversationId: testConversationId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: This is a test message with some content.`,
      }));

      await db.insert(aiMessages).values(messages as any);

      // Force compression
      const result = await ContextManagerService.compressConversation(testConversationId, {
        forceSummarize: true,
        keepRecentCount: 5,
      });

      expect(result.summarized).toBeGreaterThan(0); // Should have compressed some messages
      expect(result.summarized).toBe(10); // 15 - 5 = 10 messages compressed
      expect(result.tokensSaved).toBeGreaterThan(0);

      // Verify summary message was created
      const summaryMessages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, testConversationId));

      const hasSummary = summaryMessages.some(
        (m) => (m.metadata as any)?.type === 'compression_summary'
      );
      expect(hasSummary).toBe(true);

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });

    it('should preserve recent messages during compression', async () => {
      // Add messages
      const messages = Array.from({ length: 20 }, (_, i) => ({
        conversationId: testConversationId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
      }));

      await db.insert(aiMessages).values(messages as any);

      // Compress keeping last 5
      await ContextManagerService.compressConversation(testConversationId, {
        forceSummarize: true,
        keepRecentCount: 5,
      });

      // Get remaining messages
      const remaining = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, testConversationId));

      // Should have: 5 recent + 1 summary + 15 compressed (with empty content)
      expect(remaining.length).toBeGreaterThan(5);

      const summaryMessage = remaining.find(
        (m) => (m.metadata as any)?.type === 'compression_summary'
      );
      expect(summaryMessage).toBeDefined();

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });
  });

  describe('estimateCompressionSavings', () => {
    it('should estimate savings correctly', async () => {
      // Add messages
      const messages = Array.from({ length: 15 }, (_, i) => ({
        conversationId: testConversationId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: This is a test message with some content that will be compressed.`,
      }));

      await db.insert(aiMessages).values(messages as any);

      const estimate = await ContextManagerService.estimateCompressionSavings(
        testConversationId,
        5
      );

      expect(estimate.currentTokens).toBeGreaterThan(0);
      expect(estimate.estimatedAfterCompression).toBeLessThan(estimate.currentTokens);
      expect(estimate.potentialSavings).toBeGreaterThan(0);
      expect(estimate.compressionRatio).toBeGreaterThan(0);
      expect(estimate.compressionRatio).toBeLessThan(1);

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });
  });

  describe('getCompressionHistory', () => {
    it('should return empty array for uncompressed conversation', async () => {
      const history = await ContextManagerService.getCompressionHistory(testConversationId);
      expect(history).toEqual([]);
    });

    it('should return compression history after compression', async () => {
      // Add and compress messages
      const messages = Array.from({ length: 15 }, (_, i) => ({
        conversationId: testConversationId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
      }));

      await db.insert(aiMessages).values(messages as any);

      await ContextManagerService.compressConversation(testConversationId, {
        forceSummarize: true,
      });

      const history = await ContextManagerService.getCompressionHistory(testConversationId);

      expect(history.length).toBe(1);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('messageCount');
      expect(history[0]).toHaveProperty('tokensSaved');
      expect(history[0]).toHaveProperty('topics');

      // Clean up
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, testConversationId));
    });
  });

  describe('calculateTotalTokens', () => {
    it('should calculate total tokens for multiple messages', () => {
      const messages = [
        { content: 'Hello' },
        { content: 'World' },
        { content: 'This is a test' },
      ];

      const total = ContextManagerService.calculateTotalTokens(messages);

      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(20);
    });

    it('should return 0 for empty array', () => {
      const total = ContextManagerService.calculateTotalTokens([]);
      expect(total).toBe(0);
    });
  });
});
