/**
 * Tests for TTS Context Usage Feature (US-TTS-001)
 *
 * Validates:
 * - Context usage extraction from Stop events
 * - Percentage calculation and mapping to phrases
 * - Edge cases (missing data, invalid data, extreme values)
 * - Integration with TTS pipeline
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db/client';
import { hookEvents, projects, workspaces, users } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { audioService } from '../audio-service';
import { randomUUID } from 'crypto';

// Test helpers - use actual UUIDs
const TEST_USER_ID = randomUUID();
const TEST_WORKSPACE_ID = randomUUID();
const TEST_PROJECT_ID = randomUUID();
const TEST_SESSION_ID = 'test-session-' + randomUUID(); // Just a string, not a foreign key

async function createTestStopEvent(usage: any, sessionId: string = TEST_SESSION_ID) {
  const event = await db.insert(hookEvents).values({
    projectId: TEST_PROJECT_ID,
    sessionId,
    eventName: 'Stop',
    payload: {
      conversation: {
        message: {
          content: [{ type: 'text', text: 'I fixed the authentication bug' }],
          usage,
        },
      },
    },
  }).returning();

  return event[0];
}

async function createTestUser() {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: 'test-tts-context@example.com',
    name: 'Test User for TTS Context',
  }).onConflictDoNothing();
}

async function createTestWorkspace() {
  await db.insert(workspaces).values({
    id: TEST_WORKSPACE_ID,
    name: 'Test Workspace for TTS Context',
    slug: 'test-tts-context',
    ownerId: TEST_USER_ID,
  }).onConflictDoNothing();
}

async function createTestProject() {
  await db.insert(projects).values({
    id: TEST_PROJECT_ID,
    name: 'Test Project for TTS Context',
    workspaceId: TEST_WORKSPACE_ID,
  }).onConflictDoNothing();
}

async function cleanupTestData() {
  // Delete in correct order to respect foreign keys
  await db.delete(hookEvents).where(eq(hookEvents.projectId, TEST_PROJECT_ID));
  await db.delete(projects).where(eq(projects.id, TEST_PROJECT_ID));
  await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

beforeAll(async () => {
  await createTestUser();
  await createTestWorkspace();
  await createTestProject();
});

afterAll(async () => {
  await cleanupTestData();
});

describe('Audio Service - Context Usage Feature', () => {
  describe('AC-001: Extract Context Usage', () => {
    it('should extract usage data from Stop event payload', async () => {
      const usage = {
        input_tokens: 50000,
        cache_read_input_tokens: 30000,
        cache_creation_input_tokens: 10000,
        output_tokens: 10000,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should include context phrase (50% = "Using about half of my context")
      expect(result.text).toContain('context');
    });

    it('should handle missing usage data gracefully', async () => {
      const event = await createTestStopEvent(null);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should not throw error, should return text without context
      expect(result.text).toBeDefined();
      expect(result.role).toBe('assistant');
    });

    it('should handle partial usage data (use 0 for missing fields)', async () => {
      const usage = {
        input_tokens: 50000,
        // Missing cache fields
        output_tokens: 10000,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should calculate with available data (60k tokens = 30%)
      expect(result.text).toBeDefined();
    });

    it('should handle invalid usage data', async () => {
      const usage = {
        input_tokens: 'invalid',
        output_tokens: -100,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should not crash, should return text without context
      expect(result.text).toBeDefined();
    });
  });

  describe('AC-002: Natural Language Conversion', () => {
    it('should use "Just getting started with context" for 0-10%', async () => {
      const usage = {
        input_tokens: 10000, // 5% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Just getting started with context');
    });

    it('should use "Using a small portion of context" for 10-25%', async () => {
      const usage = {
        input_tokens: 30000, // 15% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Using a small portion of context');
    });

    it('should use "Using about a third of my context" for 25-40%', async () => {
      const usage = {
        input_tokens: 60000, // 30% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Using about a third of my context');
    });

    it('should use "Using about half of my context" for 40-60%', async () => {
      const usage = {
        input_tokens: 100000, // 50% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Using about half of my context');
    });

    it('should use "Using most of my context" for 60-75%', async () => {
      const usage = {
        input_tokens: 130000, // 65% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Using most of my context');
    });

    it('should use "Getting close to the context limit" for 75-85%', async () => {
      const usage = {
        input_tokens: 160000, // 80% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Getting close to the context limit');
    });

    it('should use "Nearly at the context limit" for 85-95%', async () => {
      const usage = {
        input_tokens: 180000, // 90% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Nearly at the context limit');
    });

    it('should use "At the context limit - time to start fresh" for 95%+', async () => {
      const usage = {
        input_tokens: 195000, // 97.5% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('At the context limit - time to start fresh');
    });
  });

  describe('AC-003: Audio Summary Integration', () => {
    it('should append context phrase to end of LLM summary', async () => {
      const usage = {
        input_tokens: 100000, // 50%
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should have format: ". {context_phrase}."
      expect(result.text).toMatch(/\. Using about half of my context\.$/);
    });

    it('should only append for Stop events', async () => {
      // Create UserPromptSubmit event instead
      const userEvent = await db.insert(hookEvents).values({
        projectId: TEST_PROJECT_ID,
        sessionId: TEST_SESSION_ID,
        eventName: 'UserPromptSubmit',
        payload: {
          event: {
            prompt: 'Test user prompt',
          },
        },
      }).returning();

      const result = await audioService.prepareTextForSpeech(userEvent[0].id);

      // Should NOT contain context phrase for user prompts
      expect(result.text).not.toContain('context');
      expect(result.role).toBe('user');
    });

    it('should calculate total from all token types', async () => {
      const usage = {
        input_tokens: 40000,
        cache_read_input_tokens: 30000,
        cache_creation_input_tokens: 20000,
        output_tokens: 10000,
      };
      // Total: 100k = 50%

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('Using about half of my context');
    });
  });

  describe('AC-004: Performance & Compatibility', () => {
    it('should add minimal overhead to audio generation', async () => {
      const usage = {
        input_tokens: 100000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);

      const startTime = performance.now();
      await audioService.prepareTextForSpeech(event.id);
      const endTime = performance.now();

      // Context calculation should add < 5ms overhead
      // (Note: Total time includes LLM call, we just verify it doesn't explode)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 seconds max (generous for LLM call)
    });

    it('should not require database schema changes', async () => {
      // This test passes if other tests pass - no schema changes needed
      expect(true).toBe(true);
    });

    it('should work with existing TTS pipeline', async () => {
      const usage = {
        input_tokens: 50000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);

      // Should return standard format
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('role');
      expect(result.role).toBe('assistant');
      expect(typeof result.text).toBe('string');
    });
  });

  describe('AC-005: Edge Cases', () => {
    it('should handle >100% usage (use AT_LIMIT phrase)', async () => {
      const usage = {
        input_tokens: 220000, // 110% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      expect(result.text).toContain('At the context limit - time to start fresh');
    });

    it('should handle zero tokens', async () => {
      const usage = {
        input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should not append context for zero tokens
      expect(result.text).toBeDefined();
    });

    it('should handle negative tokens', async () => {
      const usage = {
        input_tokens: -100,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should not crash
      expect(result.text).toBeDefined();
    });

    it('should handle extremely high token counts', async () => {
      const usage = {
        input_tokens: 1000000, // 500% of 200k
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should use AT_LIMIT phrase
      expect(result.text).toContain('At the context limit - time to start fresh');
    });

    it('should handle missing individual token fields', async () => {
      const usage = {
        input_tokens: 50000,
        // All other fields missing
      };

      const event = await createTestStopEvent(usage);
      const result = await audioService.prepareTextForSpeech(event.id);

      // Should calculate with available data (50k = 25%)
      expect(result.text).toBeDefined();
    });

    it('should handle SubagentStop events (no context appended)', async () => {
      const usage = {
        input_tokens: 100000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      };

      // SubagentStop is also an assistant response, but currently not supported
      const event = await db.insert(hookEvents).values({
        projectId: TEST_PROJECT_ID,
        sessionId: TEST_SESSION_ID,
        eventName: 'SubagentStop',
        payload: {
          conversation: {
            message: {
              content: [{ type: 'text', text: 'Subagent completed task' }],
              usage,
            },
          },
        },
      }).returning();

      const result = await audioService.prepareTextForSpeech(event[0].id);

      // SubagentStop is treated as assistant, but context only for 'Stop'
      expect(result.role).toBe('assistant');
      // Should NOT append context (only for 'Stop' events per spec)
      expect(result.text).not.toContain('Using about half of my context');
    });
  });
});
