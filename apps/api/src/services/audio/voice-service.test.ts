/**
 * Voice Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db } from '@agios/db/client';
import { voices, globalVoiceSettings, projectVoiceSettings, projects, workspaces } from '@agios/db/schema';
import { VoiceService } from './voice-service';
import { eq } from 'drizzle-orm';

describe('VoiceService', () => {
  let testVoiceId1: string;
  let testVoiceId2: string;
  let testProjectId: string | undefined;
  let existingGlobalSettings: any[] = [];

  beforeEach(async () => {
    // Save existing global voice settings to restore later
    existingGlobalSettings = await db.select().from(globalVoiceSettings);

    // Use an existing project if available, otherwise skip project tests
    const existingProject = await db.query.projects.findFirst();
    if (existingProject) {
      testProjectId = existingProject.id;
    }

    // Create test voices
    const [voice1] = await db
      .insert(voices)
      .values({
        provider: 'elevenlabs',
        externalId: 'test-voice-1',
        name: 'Test Voice 1',
        gender: 'male',
        useForSummaries: true,
      })
      .returning();
    testVoiceId1 = voice1.id;

    const [voice2] = await db
      .insert(voices)
      .values({
        provider: 'elevenlabs',
        externalId: 'test-voice-2',
        name: 'Test Voice 2',
        gender: 'female',
        useForSummaries: false,
      })
      .returning();
    testVoiceId2 = voice2.id;
  });

  afterEach(async () => {
    // Clean up test data (cascades will handle foreign keys)
    try {
      await db.delete(projectVoiceSettings).execute();

      // Restore global voice settings instead of deleting all
      if (existingGlobalSettings.length > 0) {
        await db.delete(globalVoiceSettings).execute();
        await db.insert(globalVoiceSettings).values(existingGlobalSettings);
      }

      await db.delete(voices).where(eq(voices.externalId, 'test-voice-1')).execute();
      await db.delete(voices).where(eq(voices.externalId, 'test-voice-2')).execute();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('listVoices', () => {
    it('should list all voices', async () => {
      const allVoices = await VoiceService.listVoices(db);
      expect(allVoices.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by gender', async () => {
      const maleVoices = await VoiceService.listVoices(db, { gender: 'male' });
      expect(maleVoices.every((v) => v.gender === 'male')).toBe(true);
    });

    it('should filter by useForSummaries', async () => {
      const summaryVoices = await VoiceService.listVoices(db, { useForSummaries: true });
      expect(summaryVoices.every((v) => v.useForSummaries === true)).toBe(true);
    });
  });

  describe('getVoiceById', () => {
    it('should get voice by ID', async () => {
      const voice = await VoiceService.getVoiceById(db, testVoiceId1);
      expect(voice).toBeDefined();
      expect(voice?.name).toBe('Test Voice 1');
    });

    it('should return undefined for non-existent voice', async () => {
      const voice = await VoiceService.getVoiceById(db, '00000000-0000-0000-0000-000000000000');
      expect(voice).toBeUndefined();
    });
  });

  describe('updateVoice', () => {
    it('should update voice metadata', async () => {
      const updated = await VoiceService.updateVoice(db, testVoiceId1, {
        useForSummaries: false,
        metadata: { test: 'data' },
      });
      expect(updated?.useForSummaries).toBe(false);
      expect(updated?.metadata).toEqual({ test: 'data' });
    });
  });

  describe('globalVoiceSettings', () => {
    it('should create global settings', async () => {
      const settings = await VoiceService.upsertGlobalSettings(
        db,
        testVoiceId1,
        testVoiceId2
      );
      expect(settings.userVoiceId).toBe(testVoiceId1);
      expect(settings.assistantVoiceId).toBe(testVoiceId2);
    });

    it('should update existing global settings', async () => {
      // Create first
      await VoiceService.upsertGlobalSettings(db, testVoiceId1, testVoiceId2);

      // Update
      const updated = await VoiceService.upsertGlobalSettings(
        db,
        testVoiceId2,
        testVoiceId1
      );
      expect(updated.userVoiceId).toBe(testVoiceId2);
      expect(updated.assistantVoiceId).toBe(testVoiceId1);

      // Should still be singleton
      const all = await db.query.globalVoiceSettings.findMany();
      expect(all.length).toBe(1);
    });

    it('should get global settings', async () => {
      await VoiceService.upsertGlobalSettings(db, testVoiceId1, testVoiceId2);
      const settings = await VoiceService.getGlobalSettings(db);
      expect(settings).toBeDefined();
      expect(settings?.userVoiceId).toBe(testVoiceId1);
    });
  });

  describe('projectVoiceSettings', () => {
    it('should create project settings', async () => {
      if (!testProjectId) {
        console.log('Skipping project test - no project available');
        return;
      }
      const settings = await VoiceService.upsertProjectSettings(
        db,
        testProjectId,
        testVoiceId1,
        testVoiceId2
      );
      expect(settings.projectId).toBe(testProjectId);
      expect(settings.userVoiceId).toBe(testVoiceId1);
      expect(settings.assistantVoiceId).toBe(testVoiceId2);
    });

    it('should update existing project settings', async () => {
      if (!testProjectId) {
        console.log('Skipping project test - no project available');
        return;
      }
      // Create first
      await VoiceService.upsertProjectSettings(db, testProjectId, testVoiceId1, testVoiceId2);

      // Update only user voice
      const updated = await VoiceService.upsertProjectSettings(
        db,
        testProjectId,
        testVoiceId2
      );
      expect(updated.userVoiceId).toBe(testVoiceId2);
      expect(updated.assistantVoiceId).toBe(testVoiceId2); // Should keep existing
    });

    it('should get project settings', async () => {
      if (!testProjectId) {
        console.log('Skipping project test - no project available');
        return;
      }
      await VoiceService.upsertProjectSettings(db, testProjectId, testVoiceId1, testVoiceId2);
      const settings = await VoiceService.getProjectSettings(db, testProjectId);
      expect(settings).toBeDefined();
      expect(settings?.projectId).toBe(testProjectId);
    });
  });
});
