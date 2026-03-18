/**
 * AI Chat Integration Tests
 * Tests for actual API behavior with database
 */

import { config } from 'dotenv';
config();

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db/client';
import { aiConfig, aiConversations, aiMessages } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';
import { encryptApiKey } from '../../../lib/crypto';
import { randomUUID } from 'crypto';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const TEST_WORKSPACE_ID = randomUUID();
const TEST_USER_ID = randomUUID();

describe('AI Chat Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data for this workspace
    const conversations = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.workspaceId, TEST_WORKSPACE_ID));

    for (const conv of conversations) {
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, conv.id));
    }

    await db
      .delete(aiConversations)
      .where(eq(aiConversations.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(aiConfig).where(eq(aiConfig.workspaceId, TEST_WORKSPACE_ID));
  });

  afterAll(async () => {
    // Clean up test data
    const conversations = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.workspaceId, TEST_WORKSPACE_ID));

    for (const conv of conversations) {
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, conv.id));
    }

    await db
      .delete(aiConversations)
      .where(eq(aiConversations.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(aiConfig).where(eq(aiConfig.workspaceId, TEST_WORKSPACE_ID));
  });

  describe('BUG-AI-001: Message Persistence on AI Failure', () => {
    test('should save user message even when OpenRouter fails (no API key)', async () => {
      // Scenario: User sends message but OpenRouter has no valid API key
      // Expected: User message should be saved even though AI fails to respond

      const userMessage = 'Hello, this message should be saved!';

      // Send message (should fail because no API key configured)
      const response = await fetch(
        `${API_URL}/api/v1/ai/workspaces/${TEST_WORKSPACE_ID}/chat/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            context: { userId: TEST_USER_ID },
          }),
        }
      );

      // Should return 400 (no API key configured)
      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toBeDefined();

      // CRITICAL: User message should still be saved to database
      const conversations = await db
        .select()
        .from(aiConversations)
        .where(
          and(
            eq(aiConversations.userId, TEST_USER_ID),
            eq(aiConversations.workspaceId, TEST_WORKSPACE_ID)
          )
        );

      expect(conversations.length).toBeGreaterThan(0);
      const conversation = conversations[0];

      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversation.id));

      // User message MUST be saved
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe(userMessage);
    });

    test('should save user message even when OpenRouter API fails', async () => {
      // Setup: Create config with invalid API key
      await db.insert(aiConfig).values({
        workspaceId: TEST_WORKSPACE_ID,
        model: 'anthropic/claude-3.5-haiku',
        maxTokens: 4096,
        temperature: '0.7',
        apiKeyEncrypted: encryptApiKey('invalid-key-will-fail'),
      });

      const userMessage = 'This message should persist despite API failure';

      // Send message (should fail because invalid API key)
      const response = await fetch(
        `${API_URL}/api/v1/ai/workspaces/${TEST_WORKSPACE_ID}/chat/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            context: { userId: TEST_USER_ID },
          }),
        }
      );

      // Should return 502 (AI service unavailable)
      expect(response.status).toBe(502);

      // CRITICAL: User message should still be saved
      const conversations = await db
        .select()
        .from(aiConversations)
        .where(
          and(
            eq(aiConversations.userId, TEST_USER_ID),
            eq(aiConversations.workspaceId, TEST_WORKSPACE_ID)
          )
        );

      expect(conversations.length).toBeGreaterThan(0);
      const conversation = conversations[0];

      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversation.id));

      // Should have at least the user message
      const userMessages = messages.filter((m) => m.role === 'user');
      expect(userMessages.length).toBeGreaterThan(0);
      expect(userMessages.some((m) => m.content === userMessage)).toBe(true);
    });
  });

  describe('BUG-AI-002: Invalid JSON should return 400', () => {
    test('should return 400 for malformed JSON', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/ai/workspaces/${TEST_WORKSPACE_ID}/chat/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid json here}',
        }
      );

      // Should return 400, not 500
      expect(response.status).toBe(400);
    });

    test('should return 400 for missing required fields', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/ai/workspaces/${TEST_WORKSPACE_ID}/chat/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Missing 'message' field
        }
      );

      // Should return 400 for validation error
      expect(response.status).toBe(400);
    });
  });

  describe('BUG-AI-003: Missing API key should return 400 with helpful message', () => {
    test('should return 400 with helpful message when API key not configured', async () => {
      const freshWorkspace = randomUUID();

      const response = await fetch(
        `${API_URL}/api/v1/ai/workspaces/${freshWorkspace}/chat/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Test message',
            context: { userId: 'test-user' },
          }),
        }
      );

      // Should return 400, not 500
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
      // Should mention API key
      expect(data.error.toLowerCase()).toContain('api key');
    });
  });
});
