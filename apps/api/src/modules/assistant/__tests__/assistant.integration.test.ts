/**
 * Assistant API Integration Tests
 * Tests the POST /api/v1/assistant/chat endpoint with streaming
 * and CRUD operations for conversations
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
import path from 'path';

// Load .env configuration from project root
config({ path: path.resolve(__dirname, '../../../../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to get test workspace
async function getTestWorkspace(): Promise<string> {
  // Use a known test workspace ID from database
  // Query: SELECT id FROM workspaces LIMIT 1;
  // This ID should exist in any dev environment with seed data
  return '9d753529-cc68-4a23-9063-68ac0e952403';
}

describe('Assistant Conversations API', () => {
  let testWorkspaceId: string;
  let testConversationId: string;

  beforeAll(async () => {
    testWorkspaceId = await getTestWorkspace();
  });

  it('POST /assistant/conversations creates new conversation', async () => {
    const response = await fetch(`${API_URL}/api/v1/assistant/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('conversation');
    expect(data.conversation).toHaveProperty('id');
    expect(data.conversation.workspaceId).toBe(testWorkspaceId);

    // Save for subsequent tests
    testConversationId = data.conversation.id;
  });

  it('GET /assistant/conversations lists conversations', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/assistant/conversations?workspaceId=${testWorkspaceId}`
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('conversations');
    expect(Array.isArray(data.conversations)).toBe(true);
  });

  it('GET /assistant/conversations/:id returns conversation with messages', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/assistant/conversations/${testConversationId}`
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('conversation');
    expect(data.conversation.id).toBe(testConversationId);
    expect(data.conversation).toHaveProperty('messages');
    expect(Array.isArray(data.conversation.messages)).toBe(true);
  });

  it('GET /assistant/conversations/:id returns 404 for non-existent conversation', async () => {
    const fakeId = '00000000-0000-0000-0000-999999999999';
    const response = await fetch(
      `${API_URL}/api/v1/assistant/conversations/${fakeId}`
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('DELETE /assistant/conversations/:id deletes conversation', async () => {
    // Create a conversation to delete
    const createResponse = await fetch(`${API_URL}/api/v1/assistant/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
      }),
    });
    const createData = await createResponse.json();
    const conversationId = createData.conversation.id;

    // Delete it
    const deleteResponse = await fetch(
      `${API_URL}/api/v1/assistant/conversations/${conversationId}`,
      {
        method: 'DELETE',
      }
    );

    expect(deleteResponse.status).toBe(200);
    const data = await deleteResponse.json();
    expect(data.success).toBe(true);

    // Verify it's gone
    const getResponse = await fetch(
      `${API_URL}/api/v1/assistant/conversations/${conversationId}`
    );
    expect(getResponse.status).toBe(404);
  });
});

describe('Assistant Chat Streaming API', () => {
  let testWorkspaceId: string;
  let testConversationId: string;

  beforeAll(async () => {
    testWorkspaceId = await getTestWorkspace();

    // Create a test conversation
    const response = await fetch(`${API_URL}/api/v1/assistant/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
      }),
    });
    const data = await response.json();
    testConversationId = data.conversation.id;
  });

  it('POST /assistant/chat streams response correctly', async () => {
    // Skip if no API key configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('⚠️  Skipping streaming test - ANTHROPIC_API_KEY not configured');
      return;
    }

    const response = await fetch(`${API_URL}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: testConversationId,
        message: 'Hello! Please respond with exactly: "Test successful"',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    // Read the stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    let chunks: string[] = [];
    let done = false;
    let receivedDone = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr);

            if (data.type === 'content') {
              chunks.push(data.content);
            } else if (data.type === 'done') {
              receivedDone = true;
            } else if (data.type === 'error') {
              throw new Error(`Stream error: ${data.error}`);
            }
          }
        }
      }
    }

    // Verify we received chunks and completion signal
    expect(chunks.length).toBeGreaterThan(0);
    expect(receivedDone).toBe(true);

    const fullResponse = chunks.join('');
    expect(fullResponse.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for streaming test

  it('POST /assistant/chat returns error for missing conversationId', async () => {
    const response = await fetch(`${API_URL}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /assistant/chat returns error for missing message', async () => {
    const response = await fetch(`${API_URL}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: testConversationId,
      }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /assistant/chat saves messages to database', async () => {
    // Skip if no API key configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('⚠️  Skipping database test - ANTHROPIC_API_KEY not configured');
      return;
    }

    const testMessage = 'What is Agios?';

    // Send message
    const chatResponse = await fetch(`${API_URL}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: testConversationId,
        message: testMessage,
      }),
    });

    // Consume the stream
    const reader = chatResponse.body?.getReader();
    if (reader) {
      let done = false;
      while (!done) {
        const { done: streamDone } = await reader.read();
        done = streamDone;
      }
    }

    // Verify messages were saved
    const getResponse = await fetch(
      `${API_URL}/api/v1/assistant/conversations/${testConversationId}`
    );
    const data = await getResponse.json();

    expect(data.conversation.messages.length).toBeGreaterThanOrEqual(2);

    // Find our test message
    const userMessage = data.conversation.messages.find(
      (m: any) => m.role === 'user' && m.content === testMessage
    );
    expect(userMessage).toBeDefined();

    // Should have an assistant response
    const assistantMessage = data.conversation.messages.find(
      (m: any) => m.role === 'assistant'
    );
    expect(assistantMessage).toBeDefined();
  }, 30000);
});

describe('Assistant Conversation Listing', () => {
  let testWorkspaceId: string;

  beforeAll(async () => {
    testWorkspaceId = await getTestWorkspace();
  });

  it('lists conversations with message count', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/assistant/conversations?workspaceId=${testWorkspaceId}`
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    if (data.conversations.length > 0) {
      const conversation = data.conversations[0];
      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('createdAt');
      expect(conversation).toHaveProperty('updatedAt');
      expect(conversation).toHaveProperty('messageCount');
      expect(conversation).toHaveProperty('lastMessagePreview');
      expect(typeof conversation.messageCount).toBe('number');
    }
  });

  it('respects limit parameter', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/assistant/conversations?workspaceId=${testWorkspaceId}&limit=5`
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.conversations.length).toBeLessThanOrEqual(5);
  });

  it('returns 400 for missing workspaceId', async () => {
    const response = await fetch(`${API_URL}/api/v1/assistant/conversations`);
    expect(response.status).toBe(400);
  });
});
