/**
 * Memory Service Tests
 * Unit tests for workspace memory CRUD operations
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { workspaceMemory, workspaces, aiConversations, users } from '@agios/db';
import { MemoryService } from '../memory.service';
import { eq } from 'drizzle-orm';

describe('MemoryService', () => {
  let testWorkspaceId: string;
  let testConversationId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      email: 'test-memory@test.com',
      name: 'Test User',
      emailVerified: false,
    }).returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db.insert(workspaces).values({
      name: 'Test Workspace - Memory',
      slug: 'test-workspace-memory',
      ownerId: testUserId,
    }).returning();
    testWorkspaceId = workspace.id;

    // Create test conversation
    const [conversation] = await db.insert(aiConversations).values({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      title: 'Test Conversation',
    }).returning();
    testConversationId = conversation.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data (cascade will handle related records)
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('addMemory', () => {
    test('should add a pattern memory', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'pattern',
        key: 'auth_pattern',
        value: 'We use JWT with refresh tokens',
        category: 'architecture',
        conversationId: testConversationId,
        tags: ['auth', 'jwt'],
      });

      expect(memory).toBeDefined();
      expect(memory.memoryType).toBe('pattern');
      expect(memory.key).toBe('auth_pattern');
      expect(memory.value).toBe('We use JWT with refresh tokens');
      expect(memory.category).toBe('architecture');
      expect(memory.confidence).toBe(1.0);
      expect(memory.status).toBe('active');
      expect(memory.tags).toEqual(['auth', 'jwt']);
    });

    test('should add a decision memory', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'decision',
        key: 'api_framework',
        value: 'Use ElysiaJS for all new APIs',
        category: 'decisions',
        conversationId: testConversationId,
      });

      expect(memory.memoryType).toBe('decision');
      expect(memory.key).toBe('api_framework');
    });

    test('should add memory with default confidence', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'project_name',
        value: 'Agios CRM Platform',
      });

      expect(memory.confidence).toBe(1.0);
    });

    test('should add memory with custom confidence', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'team_size',
        value: '5 developers',
        confidence: 0.8,
      });

      expect(memory.confidence).toBe(0.8);
    });
  });

  describe('getMemories', () => {
    test('should get all memories for workspace', async () => {
      const memories = await MemoryService.getMemories(testWorkspaceId);
      expect(memories.length).toBeGreaterThan(0);
    });

    test('should filter by type', async () => {
      const memories = await MemoryService.getMemories(testWorkspaceId, {
        type: 'pattern',
      });

      for (const memory of memories) {
        expect(memory.memoryType).toBe('pattern');
      }
    });

    test('should filter by category', async () => {
      const memories = await MemoryService.getMemories(testWorkspaceId, {
        category: 'architecture',
      });

      for (const memory of memories) {
        expect(memory.category).toBe('architecture');
      }
    });

    test('should filter by status', async () => {
      const memories = await MemoryService.getMemories(testWorkspaceId, {
        status: 'active',
      });

      for (const memory of memories) {
        expect(memory.status).toBe('active');
      }
    });

    test('should filter by minimum confidence', async () => {
      const memories = await MemoryService.getMemories(testWorkspaceId, {
        minConfidence: 0.9,
      });

      for (const memory of memories) {
        expect(memory.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe('searchMemory', () => {
    test('should search by key', async () => {
      const memories = await MemoryService.searchMemory(testWorkspaceId, 'auth');
      expect(memories.length).toBeGreaterThan(0);
      expect(memories.some(m => m.key.includes('auth'))).toBe(true);
    });

    test('should search by value', async () => {
      const memories = await MemoryService.searchMemory(testWorkspaceId, 'JWT');
      expect(memories.length).toBeGreaterThan(0);
      expect(memories.some(m => m.value.includes('JWT'))).toBe(true);
    });

    test('should search by tag', async () => {
      const memories = await MemoryService.searchMemory(testWorkspaceId, 'jwt');
      expect(memories.length).toBeGreaterThan(0);
    });

    test('should return empty for non-matching query', async () => {
      const memories = await MemoryService.searchMemory(testWorkspaceId, 'xyzabc123');
      expect(memories.length).toBe(0);
    });

    test('should limit results to 10', async () => {
      // Add more memories to test limit
      for (let i = 0; i < 15; i++) {
        await MemoryService.addMemory({
          workspaceId: testWorkspaceId,
          type: 'fact',
          key: `test_key_${i}`,
          value: `Test value with common search term ${i}`,
          tags: ['search'],
        });
      }

      const memories = await MemoryService.searchMemory(testWorkspaceId, 'search term');
      expect(memories.length).toBeLessThanOrEqual(10);
    });
  });

  describe('updateMemory', () => {
    test('should update memory value', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'update_test',
        value: 'Original value',
      });

      const updated = await MemoryService.updateMemory(memory.id, {
        value: 'Updated value',
      });

      expect(updated.value).toBe('Updated value');
    });

    test('should update memory confidence', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'confidence_test',
        value: 'Test value',
      });

      const updated = await MemoryService.updateMemory(memory.id, {
        confidence: 0.5,
      });

      expect(updated.confidence).toBe(0.5);
    });

    test('should update memory status', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'status_test',
        value: 'Test value',
      });

      const updated = await MemoryService.updateMemory(memory.id, {
        status: 'deprecated',
      });

      expect(updated.status).toBe('deprecated');
    });
  });

  describe('deleteMemory', () => {
    test('should delete memory', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'delete_test',
        value: 'To be deleted',
      });

      await MemoryService.deleteMemory(memory.id);

      const retrieved = await MemoryService.getMemoryById(memory.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('addDecision', () => {
    test('should add decision with rationale', async () => {
      const decision = await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key: 'database_choice',
        decision: 'Use PostgreSQL',
        rationale: 'Better support for JSONB and advanced features',
        conversationId: testConversationId,
      });

      expect(decision.memoryType).toBe('decision');
      expect(decision.key).toBe('database_choice');
      expect(decision.value).toContain('Use PostgreSQL');
      expect(decision.value).toContain('Rationale:');
      expect(decision.value).toContain('Better support for JSONB');
    });

    test('should supersede old decision', async () => {
      // Add first decision
      const oldDecision = await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key: 'test_framework',
        decision: 'Use Jest',
        conversationId: testConversationId,
      });

      expect(oldDecision.status).toBe('active');

      // Add new decision that supersedes the old one
      const newDecision = await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key: 'test_framework',
        decision: 'Use Bun Test',
        conversationId: testConversationId,
        supersedes: oldDecision.id,
      });

      // Verify old decision is superseded
      const superseded = await MemoryService.getMemoryById(oldDecision.id);
      expect(superseded?.status).toBe('superseded');
      expect(superseded?.supersededBy).toBe(newDecision.id);

      // Verify new decision is active
      expect(newDecision.status).toBe('active');
    });
  });

  describe('getDecisionHistory', () => {
    test('should return decision history in reverse chronological order', async () => {
      const key = 'decision_history_test';

      // Add multiple decisions
      await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key,
        decision: 'Decision 1',
        conversationId: testConversationId,
      });

      await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key,
        decision: 'Decision 2',
        conversationId: testConversationId,
      });

      const history = await MemoryService.getDecisionHistory(testWorkspaceId, key);

      expect(history.length).toBe(2);
      // Most recent first
      expect(history[0].value).toContain('Decision 2');
      expect(history[1].value).toContain('Decision 1');
    });
  });

  describe('getActiveDecision', () => {
    test('should return only active decision', async () => {
      const key = 'active_decision_test';

      // Add decision
      const first = await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key,
        decision: 'First decision',
        conversationId: testConversationId,
      });

      // Supersede with new decision
      const second = await MemoryService.addDecision({
        workspaceId: testWorkspaceId,
        key,
        decision: 'Second decision',
        conversationId: testConversationId,
        supersedes: first.id,
      });

      const active = await MemoryService.getActiveDecision(testWorkspaceId, key);

      expect(active).toBeDefined();
      expect(active?.id).toBe(second.id);
      expect(active?.status).toBe('active');
    });

    test('should return null if no active decision', async () => {
      const active = await MemoryService.getActiveDecision(
        testWorkspaceId,
        'nonexistent_key'
      );
      expect(active).toBeNull();
    });
  });

  describe('addPreference', () => {
    test('should add workspace-level preference', async () => {
      const pref = await MemoryService.addPreference({
        workspaceId: testWorkspaceId,
        category: 'tools',
        key: 'package_manager',
        value: 'bun',
      });

      expect(pref.memoryType).toBe('preference');
      expect(pref.key).toBe('package_manager');
      expect(pref.category).toBe('tools');
    });

    test('should add user-level preference', async () => {
      const userId = 'user-123';
      const pref = await MemoryService.addPreference({
        workspaceId: testWorkspaceId,
        userId,
        category: 'style',
        key: 'code_style',
        value: 'prettier',
      });

      expect(pref.key).toBe(`user:${userId}:code_style`);
    });
  });

  describe('getPreferences', () => {
    test('should get all preferences', async () => {
      const prefs = await MemoryService.getPreferences(testWorkspaceId);
      expect(prefs.length).toBeGreaterThan(0);
    });

    test('should filter by userId', async () => {
      const userId = 'user-456';

      await MemoryService.addPreference({
        workspaceId: testWorkspaceId,
        userId,
        category: 'test',
        key: 'test_pref',
        value: 'test value',
      });

      const prefs = await MemoryService.getPreferences(testWorkspaceId, {
        userId,
      });

      for (const pref of prefs) {
        expect(pref.key).toContain(`user:${userId}:`);
      }
    });

    test('should filter by category', async () => {
      const prefs = await MemoryService.getPreferences(testWorkspaceId, {
        category: 'tools',
      });

      for (const pref of prefs) {
        expect(pref.category).toBe('tools');
      }
    });
  });

  describe('getEffectivePreference', () => {
    test('should return workspace-level preference when no user preference', async () => {
      const key = 'effective_test_1';

      await MemoryService.addPreference({
        workspaceId: testWorkspaceId,
        category: 'test',
        key,
        value: 'workspace value',
      });

      const effective = await MemoryService.getEffectivePreference(
        testWorkspaceId,
        key
      );

      expect(effective?.value).toBe('workspace value');
    });

    test('should return user-level preference when it exists', async () => {
      const key = 'effective_test_2';
      const userId = 'user-789';

      // Add workspace-level
      await MemoryService.addPreference({
        workspaceId: testWorkspaceId,
        category: 'test',
        key,
        value: 'workspace value',
      });

      // Add user-level (should override)
      await MemoryService.addPreference({
        workspaceId: testWorkspaceId,
        userId,
        category: 'test',
        key,
        value: 'user value',
      });

      const effective = await MemoryService.getEffectivePreference(
        testWorkspaceId,
        key,
        userId
      );

      expect(effective?.value).toBe('user value');
    });

    test('should return null when no preference exists', async () => {
      const effective = await MemoryService.getEffectivePreference(
        testWorkspaceId,
        'nonexistent_key'
      );
      expect(effective).toBeNull();
    });
  });

  describe('markAccessed', () => {
    test('should update lastAccessed timestamp', async () => {
      const memory = await MemoryService.addMemory({
        workspaceId: testWorkspaceId,
        type: 'fact',
        key: 'access_test',
        value: 'Test value',
      });

      const originalAccessed = memory.lastAccessed;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await MemoryService.markAccessed(memory.id);

      const updated = await MemoryService.getMemoryById(memory.id);
      expect(updated?.lastAccessed.getTime()).toBeGreaterThan(originalAccessed.getTime());
    });
  });
});
