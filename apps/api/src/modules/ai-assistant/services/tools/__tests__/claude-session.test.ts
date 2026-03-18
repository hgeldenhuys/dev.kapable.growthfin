/**
 * Claude Session Service Tests
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { ClaudeSessionService } from '../claude-session.service';
import { db } from '@agios/db/client';
import { workspaces, aiConversations, aiClaudeCodeSessions } from '@agios/db';
import { eq } from 'drizzle-orm';

describe('ClaudeSessionService', () => {
  let testWorkspaceId: string;
  let testSessionId: string;

  beforeAll(async () => {
    // Get first workspace from database for testing
    const [workspace] = await db.select().from(workspaces).limit(1);

    if (!workspace) {
      throw new Error('No workspace found in database. Please create one first.');
    }

    testWorkspaceId = workspace.id;
    console.log('Using workspace:', testWorkspaceId);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testSessionId) {
      await db
        .delete(aiClaudeCodeSessions)
        .where(eq(aiClaudeCodeSessions.sessionId, testSessionId));
    }
  });

  test('should create session', async () => {
    testSessionId = `test-session-${Date.now()}`;

    const session = await ClaudeSessionService.createSession({
      workspaceId: testWorkspaceId,
      sessionId: testSessionId,
      prompt: 'Test prompt',
      result: { success: true, summary: 'Test result' },
      filesModified: ['file1.ts', 'file2.ts'],
    });

    expect(session).toBeDefined();
    expect(session.sessionId).toBe(testSessionId);
    expect(session.workspaceId).toBe(testWorkspaceId);
    expect(session.status).toBe('active');
    expect(session.filesModified).toEqual(['file1.ts', 'file2.ts']);

    console.log('✅ Created session:', session.id);
  });

  test('should retrieve session by ID', async () => {
    const session = await ClaudeSessionService.getSession(testSessionId);

    expect(session).toBeDefined();
    expect(session?.sessionId).toBe(testSessionId);
    expect(session?.workspaceId).toBe(testWorkspaceId);

    console.log('✅ Retrieved session:', session?.id);
  });

  test('should update session activity', async () => {
    const beforeUpdate = await ClaudeSessionService.getSession(testSessionId);
    expect(beforeUpdate).toBeDefined();

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 100));

    await ClaudeSessionService.updateActivity(testSessionId, {
      success: true,
      summary: 'Updated result',
    });

    const afterUpdate = await ClaudeSessionService.getSession(testSessionId);
    expect(afterUpdate).toBeDefined();
    expect(afterUpdate!.lastActive.getTime()).toBeGreaterThan(
      beforeUpdate!.lastActive.getTime()
    );

    console.log('✅ Updated session activity');
  });

  test('should cleanup expired sessions', async () => {
    // Create an expired session
    const expiredSessionId = `expired-${Date.now()}`;
    await db.insert(aiClaudeCodeSessions).values({
      workspaceId: testWorkspaceId,
      sessionId: expiredSessionId,
      status: 'active',
      prompt: 'Test',
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const deletedCount = await ClaudeSessionService.cleanupExpired();
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    const deleted = await ClaudeSessionService.getSession(expiredSessionId);
    expect(deleted).toBeNull();

    console.log('✅ Cleaned up expired sessions:', deletedCount);
  });

  test('should return null for non-existent session', async () => {
    const session = await ClaudeSessionService.getSession('non-existent-session-id');
    expect(session).toBeNull();
  });
});
