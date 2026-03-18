/**
 * End-to-End Test: Model Catalog Integration
 * Tests that model catalog selections work end-to-end
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { db } from '@agios/db/client';
import { conversations, messages, llmConfigs } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { AssistantService } from '../service';

const TEST_WORKSPACE_ID = '9d753529-cc68-4a23-9063-68ac0e952403';

describe('Model Catalog Integration E2E', () => {
  let testConversationId: string;

  beforeAll(async () => {
    // Create a test conversation
    const conversation = await AssistantService.createConversation(TEST_WORKSPACE_ID);
    testConversationId = conversation.id;
  });

  it('should handle model catalog selection (anthropic/claude-3.5-sonnet)', async () => {
    const modelName = 'anthropic/claude-3.5-sonnet';
    const userMessage = 'Say hello in exactly 3 words';

    // Stream the chat response
    let fullResponse = '';
    let chunkCount = 0;

    try {
      for await (const chunk of AssistantService.streamChatResponse(
        testConversationId,
        userMessage,
        modelName
      )) {
        fullResponse += chunk;
        chunkCount++;
      }

      // Verify we got a response
      expect(fullResponse.length).toBeGreaterThan(0);
      expect(chunkCount).toBeGreaterThan(0);

      // Verify an LLM config was created for this model
      const configName = `catalog-${modelName.replace('/', '-')}`;
      const configs = await db
        .select()
        .from(llmConfigs)
        .where(eq(llmConfigs.name, configName))
        .limit(1);

      expect(configs.length).toBe(1);
      expect(configs[0].model).toBe(modelName);
      expect(configs[0].provider).toBe('openapi');
      expect(configs[0].isActive).toBe(true);

      // Verify messages were saved
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, testConversationId));

      expect(conversationMessages.length).toBeGreaterThanOrEqual(2); // User + Assistant

      const userMsg = conversationMessages.find(m => m.role === 'user' && m.content === userMessage);
      expect(userMsg).toBeDefined();

      const assistantMsg = conversationMessages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.content.length).toBeGreaterThan(0);

      console.log(`✅ Model catalog integration test passed`);
      console.log(`   Model: ${modelName}`);
      console.log(`   Response: "${fullResponse.substring(0, 50)}..."`);
      console.log(`   Chunks received: ${chunkCount}`);
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  });

  it('should handle multiple different provider models', async () => {
    const models = [
      'openai/gpt-4o',
      'google/gemini-2.0-flash-exp',
    ];

    for (const modelName of models) {
      const conversation = await AssistantService.createConversation(TEST_WORKSPACE_ID);
      let responseReceived = false;

      try {
        for await (const chunk of AssistantService.streamChatResponse(
          conversation.id,
          'Hi',
          modelName
        )) {
          responseReceived = true;
          break; // Just verify we get at least one chunk
        }

        expect(responseReceived).toBe(true);
        console.log(`✅ Model ${modelName} works`);
      } catch (error) {
        console.error(`❌ Model ${modelName} failed:`, error);
        throw error;
      }
    }
  });

  it('should reuse existing LLM config if already created', async () => {
    const modelName = 'anthropic/claude-3.5-sonnet';
    const configName = `catalog-${modelName.replace('/', '-')}`;

    // Get count before
    const configsBefore = await db
      .select()
      .from(llmConfigs)
      .where(eq(llmConfigs.name, configName));

    const countBefore = configsBefore.length;

    // Create another conversation and send message
    const conversation = await AssistantService.createConversation(TEST_WORKSPACE_ID);

    for await (const chunk of AssistantService.streamChatResponse(
      conversation.id,
      'Hello',
      modelName
    )) {
      break; // Just get first chunk
    }

    // Get count after
    const configsAfter = await db
      .select()
      .from(llmConfigs)
      .where(eq(llmConfigs.name, configName));

    const countAfter = configsAfter.length;

    // Should not create duplicate
    expect(countAfter).toBe(countBefore);
    console.log(`✅ Config reuse works - no duplicates created`);
  });

  it('should handle legacy LLM config names (backward compatibility)', async () => {
    // Test with old-style config name (without slash)
    const conversation = await AssistantService.createConversation(TEST_WORKSPACE_ID);

    let responseReceived = false;
    try {
      for await (const chunk of AssistantService.streamChatResponse(
        conversation.id,
        'Hi',
        'chat-message-generator' // Old-style config name
      )) {
        responseReceived = true;
        break;
      }

      expect(responseReceived).toBe(true);
      console.log(`✅ Backward compatibility works with legacy config names`);
    } catch (error) {
      console.error('❌ Legacy config test failed:', error);
      throw error;
    }
  });
});
