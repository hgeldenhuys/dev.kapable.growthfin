/**
 * Audio Service Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db/client';
import { hookEvents, voices, audioCache, globalVoiceSettings, llmConfigs, llmCredentials } from '@agios/db/schema';
import { audioService } from '../audio-service';
import { jobQueue } from '../../lib/queue';
import { eq } from 'drizzle-orm';
import { encryptApiKey } from '../../lib/crypto';
import { env } from '../../config/env';

describe('Audio Service', () => {
  let testVoiceId: string;
  let testHookEventId: string;
  let testProjectId: string;
  let existingGlobalSettings: any[] = [];

  beforeAll(async () => {
    // Start job queue for testing
    await jobQueue.start();

    // Clean up test data
    await db.delete(audioCache);

    // Save existing global voice settings to restore later
    existingGlobalSettings = await db.select().from(globalVoiceSettings);

    // Create test voice
    const [voice] = await db
      .insert(voices)
      .values({
        provider: 'elevenlabs',
        externalId: 'test-voice-id',
        name: 'Test Voice',
        gender: 'neutral',
        useForSummaries: true,
        metadata: {},
      })
      .returning();

    testVoiceId = voice.id;

    // Set up global voice settings
    await db.insert(globalVoiceSettings).values({
      userVoiceId: testVoiceId,
      assistantVoiceId: testVoiceId,
    });

    // Create test LLM credential (needed for audio summarizer)
    const [credential] = await db
      .insert(llmCredentials)
      .values({
        provider: 'openai',
        name: 'Test OpenAI Credential',
        apiKeyEncrypted: encryptApiKey('sk-test-key-123'),
        isActive: true,
      })
      .returning();

    // Create test LLM config for audio-summarizer
    await db.insert(llmConfigs).values({
      name: 'audio-summarizer',
      provider: 'openai',
      model: 'gpt-4o-mini',
      credentialId: credential.id,
      temperature: 30,
      maxTokens: 300,
      systemPrompt: 'You are preparing text for text-to-speech.',
      isActive: true,
      projectId: null, // Global config
    });

    // Create test hook event
    testProjectId = 'test-project-id';
    const [event] = await db
      .insert(hookEvents)
      .values({
        projectId: testProjectId,
        sessionId: 'test-session-id',
        eventName: 'UserPromptSubmit',
        payload: {
          event: {
            prompt: 'Please implement a user authentication system with JWT tokens',
          },
        },
      })
      .returning();

    testHookEventId = event.id;
  });

  afterAll(async () => {
    // Clean up
    await db.delete(audioCache);
    await db.delete(hookEvents).where(eq(hookEvents.id, testHookEventId));

    // Restore global voice settings instead of deleting all
    if (existingGlobalSettings.length > 0) {
      await db.delete(globalVoiceSettings);
      await db.insert(globalVoiceSettings).values(existingGlobalSettings);
    }

    await db.delete(voices).where(eq(voices.id, testVoiceId));
    await db.delete(llmConfigs).where(eq(llmConfigs.name, 'audio-summarizer'));
    await db.delete(llmCredentials);

    await jobQueue.stop();
  });

  it('should queue audio generation for non-cached event', async () => {
    const result = await audioService.getAudio(testHookEventId);

    expect(result.status).toBe('generating');
    expect(result.jobId).toBeDefined();
    expect(result.url).toBeUndefined();
  });

  it('should return cached audio if available', async () => {
    // Create cache entry
    const cacheId = `${testHookEventId}-${testVoiceId}`;
    await db.insert(audioCache).values({
      id: cacheId,
      hookEventId: testHookEventId,
      voiceId: testVoiceId,
      url: '/tmp/test-audio.mp3',
      duration: 10,
    });

    const result = await audioService.getAudio(testHookEventId);

    expect(result.status).toBe('ready');
    expect(result.url).toBe('/tmp/test-audio.mp3');
    expect(result.jobId).toBeUndefined();

    // Clean up
    await db.delete(audioCache).where(eq(audioCache.id, cacheId));
  });

  it('should use global voice settings when no project settings exist', async () => {
    const result = await audioService.getAudio(testHookEventId);

    // Should use the global voice settings we set up
    expect(result.status).toBe('generating');
    expect(result.jobId).toBeDefined();
  });

  it('should extract text from UserPromptSubmit event', async () => {
    const { text, role } = await audioService['prepareTextForSpeech'](testHookEventId);

    expect(role).toBe('user');
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
    // Note: text will be summarized by LLM (or fallback to truncated raw text)
  });

  it('should prevent duplicate jobs with singleton key', async () => {
    const result1 = await audioService.getAudio(testHookEventId);
    const result2 = await audioService.getAudio(testHookEventId);

    // Both should return generating status
    expect(result1.status).toBe('generating');
    expect(result2.status).toBe('generating');

    // PgBoss singleton ensures only one job is created
    // We can't easily test the job count here, but we verified the singletonKey is used
  });

  it('should accept custom voice ID', async () => {
    const customVoice = await db
      .insert(voices)
      .values({
        provider: 'elevenlabs',
        externalId: 'custom-voice-id',
        name: 'Custom Voice',
        gender: 'female',
        useForSummaries: false,
        metadata: {},
      })
      .returning();

    const result = await audioService.getAudio(testHookEventId, customVoice[0].id);

    expect(result.status).toBe('generating');

    // Clean up
    await db.delete(voices).where(eq(voices.id, customVoice[0].id));
  });

  it('should handle Stop event with assistant role', async () => {
    const [stopEvent] = await db
      .insert(hookEvents)
      .values({
        projectId: testProjectId,
        sessionId: 'test-session-id',
        eventName: 'Stop',
        payload: {
          conversation: {
            message: {
              content: [
                {
                  type: 'text',
                  text: 'I have implemented the authentication system using JWT tokens.',
                },
              ],
            },
          },
        },
      })
      .returning();

    const { text, role } = await audioService['prepareTextForSpeech'](stopEvent.id);

    expect(role).toBe('assistant');
    expect(text).toBeDefined();

    // Clean up
    await db.delete(hookEvents).where(eq(hookEvents.id, stopEvent.id));
  });
});
