/**
 * Integration Test: Generate Audio Worker - Event Emission
 *
 * Tests that the generate-audio worker correctly emits PostgreSQL NOTIFY
 * events when audio generation completes (TWEAK-011)
 *
 * Run: bun test apps/api/src/workers/__tests__/generate-audio.integration.test.ts
 */

import { config } from 'dotenv';
config(); // Load .env file

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import postgres from 'postgres';
import { db } from '@agios/db/client';
import { audioCache, hookEvents, voices, projects } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue } from '../../lib/queue';
import type { GenerateAudioJob } from '../../lib/queue';

// Load environment
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';

describe('Generate Audio Worker - PostgreSQL NOTIFY', () => {
  let sql: postgres.Sql;
  let notificationReceived: any = null;
  let testHookEventId: string;
  let testVoiceId: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Create postgres client for LISTEN
    sql = postgres(DATABASE_URL, {
      max: 1,
      onnotice: () => {},
    });

    // Set up LISTEN for audio_generated notifications
    await sql.listen('audio_generated', (payload) => {
      notificationReceived = JSON.parse(payload);
    });

    // Create test data
    // 1. Create test project
    const [project] = await db.insert(projects).values({
      name: 'Test Project for Audio',
      agentId: 'test-agent',
      workspaceId: '00000000-0000-0000-0000-000000000001', // Test workspace from seeder
    }).returning();
    testProjectId = project.id;

    // 2. Create test hook event
    const [hookEvent] = await db.insert(hookEvents).values({
      projectId: testProjectId,
      agentId: 'test-agent',
      eventData: { test: 'data' },
    }).returning();
    testHookEventId = hookEvent.id;

    // 3. Get a voice (should exist from voice settings)
    const voice = await db.query.voices.findFirst({
      where: eq(voices.provider, 'elevenlabs'),
    });

    if (!voice) {
      throw new Error('No ElevenLabs voice found in database. Run voice seeders first.');
    }
    testVoiceId = voice.id;

    console.log('✅ Test setup complete');
    console.log(`   - Project: ${testProjectId}`);
    console.log(`   - Hook Event: ${testHookEventId}`);
    console.log(`   - Voice: ${testVoiceId}`);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(audioCache).where(eq(audioCache.hookEventId, testHookEventId));
    await db.delete(hookEvents).where(eq(hookEvents.id, testHookEventId));
    await db.delete(projects).where(eq(projects.id, testProjectId));

    // Close postgres connection
    await sql.end();
    console.log('✅ Test cleanup complete');
  });

  it('should emit audio_generated PostgreSQL NOTIFY event when audio is generated', async () => {
    // Arrange
    const testText = 'This is a test of the audio generation event emission system.';
    const testRole = 'assistant';

    notificationReceived = null; // Reset

    const job: GenerateAudioJob = {
      hookEventId: testHookEventId,
      voiceId: testVoiceId,
      text: testText,
      role: testRole,
    };

    // Act - Queue the job (worker should process it)
    await jobQueue.send('generate-audio', job);

    // Wait for worker to process (background job)
    // In real scenario this would be processed by the worker
    // For testing, we'll wait a reasonable amount of time
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Assert - Check notification was received
    expect(notificationReceived).not.toBeNull();
    expect(notificationReceived).toMatchObject({
      hookEventId: testHookEventId,
      text: testText,
      voiceId: testVoiceId,
      role: testRole,
    });

    // Verify payload structure
    expect(notificationReceived).toHaveProperty('cacheId');
    expect(notificationReceived).toHaveProperty('url');
    expect(notificationReceived.cacheId).toContain(testHookEventId);
    expect(notificationReceived.cacheId).toContain(testVoiceId);

    console.log('✅ Notification payload:', notificationReceived);
  }, 15000); // Increased timeout for worker processing

  it('should include transcribed text in the notification payload', async () => {
    // This is verified by the previous test, but we'll explicitly check
    expect(notificationReceived).toHaveProperty('text');
    expect(notificationReceived.text).toBe('This is a test of the audio generation event emission system.');
  });

  it('should include all required fields in notification payload', async () => {
    const requiredFields = ['hookEventId', 'text', 'url', 'voiceId', 'cacheId', 'role'];

    for (const field of requiredFields) {
      expect(notificationReceived).toHaveProperty(field);
      expect(notificationReceived[field]).not.toBeUndefined();
      expect(notificationReceived[field]).not.toBeNull();
    }

    console.log('✅ All required fields present');
  });

  it('should create audio_cache entry when generating audio', async () => {
    // Verify the database entry was created
    const cacheEntry = await db.query.audioCache.findFirst({
      where: eq(audioCache.hookEventId, testHookEventId),
    });

    expect(cacheEntry).not.toBeNull();
    expect(cacheEntry?.hookEventId).toBe(testHookEventId);
    expect(cacheEntry?.voiceId).toBe(testVoiceId);
    expect(cacheEntry?.url).toContain('.mp3');

    console.log('✅ Cache entry created:', cacheEntry?.id);
  });
});
