/**
 * Integration Test - askClaudeTo Tool
 * Verifies end-to-end integration without actual Claude Code execution
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { ToolExecutor } from '../tool-executor.service';
import { db } from '@agios/db/client';
import { workspaces, aiConversations, users } from '@agios/db';

describe('askClaudeTo Tool Integration', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testConversationId: string;

  beforeAll(async () => {
    // Get existing workspace and user for testing
    const [workspace] = await db.select().from(workspaces).limit(1);
    const [user] = await db.select().from(users).limit(1);

    if (!workspace || !user) {
      throw new Error('No workspace or user found in database');
    }

    testWorkspaceId = workspace.id;
    testUserId = user.id;

    // Get or create test conversation
    let [conversation] = await db
      .select()
      .from(aiConversations)
      .where((c) => c.userId === testUserId && c.workspaceId === testWorkspaceId)
      .limit(1);

    if (!conversation) {
      [conversation] = await db
        .insert(aiConversations)
        .values({
          userId: testUserId,
          workspaceId: testWorkspaceId,
        })
        .returning();
    }

    testConversationId = conversation.id;

    console.log('Test setup:');
    console.log('  Workspace:', testWorkspaceId);
    console.log('  User:', testUserId);
    console.log('  Conversation:', testConversationId);
  });

  test('should validate askClaudeTo tool parameters', async () => {
    // Missing prompt parameter
    const toolCall = {
      id: 'test-call-1',
      name: 'askClaudeTo',
      parameters: {},
    };

    const context = {
      workspaceId: testWorkspaceId,
      conversationId: testConversationId,
    };

    // This should handle the error gracefully
    const results = await ToolExecutor.executeTools([toolCall], context);

    expect(results).toHaveLength(1);
    expect(results[0].role).toBe('tool');
    expect(results[0].tool_call_id).toBe('test-call-1');

    const content = JSON.parse(results[0].content);
    expect(content.error).toBe(true);
    expect(content.message).toContain('prompt');

    console.log('✅ Parameter validation works correctly');
  });

  test('should detect dangerous operations', async () => {
    const dangerousToolCall = {
      id: 'test-call-2',
      name: 'askClaudeTo',
      parameters: {
        prompt: 'rm -rf /',
      },
    };

    const context = {
      workspaceId: testWorkspaceId,
      conversationId: testConversationId,
    };

    const results = await ToolExecutor.executeTools([dangerousToolCall], context);

    expect(results).toHaveLength(1);
    const content = JSON.parse(results[0].content);

    expect(content.error).toBe(true);
    expect(content.code).toBe('DANGEROUS_OPERATION');
    expect(content.message).toContain('rm -rf');

    console.log('✅ Dangerous operation detection works');
  });

  test('should handle execution errors gracefully', async () => {
    // Test with safe prompt that won't cause issues
    const toolCall = {
      id: 'test-call-3',
      name: 'askClaudeTo',
      parameters: {
        prompt: 'Echo "test"',
        maxTokens: 100,
      },
    };

    const context = {
      workspaceId: testWorkspaceId,
      conversationId: testConversationId,
    };

    const results = await ToolExecutor.executeTools([toolCall], context);

    expect(results).toHaveLength(1);
    const content = JSON.parse(results[0].content);

    // Should either succeed or fail gracefully with error details
    if (content.error) {
      expect(content.code).toBeDefined();
      expect(content.message).toBeDefined();
      console.log('✅ Error handled gracefully:', content.code);
    } else {
      expect(content.success).toBe(true);
      expect(content.session_id).toBeDefined();
      console.log('✅ Execution succeeded');
    }
  });

  test('should have correct tool definition in OpenRouter', async () => {
    const { OpenRouterService } = await import('../../openrouter.service');

    const askClaudeToTool = OpenRouterService.TOOLS.find(
      (t) => t.function.name === 'askClaudeTo'
    );

    expect(askClaudeToTool).toBeDefined();
    expect(askClaudeToTool!.function.description).toContain('Claude Code');
    expect(askClaudeToTool!.function.parameters.required).toContain('prompt');

    console.log('✅ Tool definition correct in OpenRouter');
  });
});
