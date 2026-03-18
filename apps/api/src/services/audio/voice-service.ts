/**
 * Voice Service
 * Business logic for voice management and settings
 */

import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  Voice,
  NewVoice,
  GlobalVoiceSettings,
  ProjectVoiceSettings,
  VoiceProvider as VoiceProviderType,
  VoiceGender,
  Model,
  NewModel,
  PronunciationDictionary,
  NewPronunciationDictionary,
} from '@agios/db/schema';
import {
  voices,
  globalVoiceSettings,
  projectVoiceSettings,
  models,
  pronunciationDictionaries,
} from '@agios/db/schema';
import type { VoiceProvider, UsageResponse } from './voice-provider.interface';
import { ElevenLabsProvider } from './elevenlabs-provider';

export class VoiceService {
  /**
   * Get voice provider instance
   */
  private static getProvider(provider: VoiceProviderType, apiKey: string): VoiceProvider {
    switch (provider) {
      case 'elevenlabs':
        return new ElevenLabsProvider(apiKey);
      case 'openai-tts':
        throw new Error('OpenAI TTS provider not implemented yet');
      default:
        throw new Error(`Unknown voice provider: ${provider}`);
    }
  }

  /**
   * Sync voices from provider API to database
   * Upserts voices based on provider + externalId
   */
  static async syncVoicesFromProvider(
    db: NodePgDatabase<any>,
    provider: VoiceProviderType,
    apiKey: string
  ): Promise<Voice[]> {
    const providerInstance = this.getProvider(provider, apiKey);
    const voicesData = await providerInstance.syncVoices();

    const syncedVoices: Voice[] = [];

    for (const voiceData of voicesData) {
      // Check if voice already exists
      const existing = await db.query.voices.findFirst({
        where: and(
          eq(voices.provider, provider),
          eq(voices.externalId, voiceData.externalId)
        ),
      });

      if (existing) {
        // Update existing voice
        const [updated] = await db
          .update(voices)
          .set({
            name: voiceData.name,
            gender: voiceData.gender,
            metadata: voiceData.metadata,
            updatedAt: new Date(),
          })
          .where(eq(voices.id, existing.id))
          .returning();
        syncedVoices.push(updated);
      } else {
        // Insert new voice
        const [created] = await db
          .insert(voices)
          .values({
            provider,
            externalId: voiceData.externalId,
            name: voiceData.name,
            gender: voiceData.gender,
            metadata: voiceData.metadata,
          })
          .returning();
        syncedVoices.push(created);
      }
    }

    return syncedVoices;
  }

  /**
   * List all voices with optional filters
   */
  static async listVoices(
    db: NodePgDatabase<any>,
    filters?: {
      provider?: VoiceProviderType;
      gender?: VoiceGender;
      useForSummaries?: boolean;
    }
  ): Promise<Voice[]> {
    const conditions = [];

    if (filters?.provider) {
      conditions.push(eq(voices.provider, filters.provider));
    }

    if (filters?.gender) {
      conditions.push(eq(voices.gender, filters.gender));
    }

    if (filters?.useForSummaries !== undefined) {
      conditions.push(eq(voices.useForSummaries, filters.useForSummaries));
    }

    return db.query.voices.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (voices, { asc }) => [asc(voices.name)],
    });
  }

  /**
   * Get voice by ID
   */
  static async getVoiceById(
    db: NodePgDatabase<any>,
    id: string
  ): Promise<Voice | undefined> {
    return db.query.voices.findFirst({
      where: eq(voices.id, id),
    });
  }

  /**
   * Update voice metadata
   */
  static async updateVoice(
    db: NodePgDatabase<any>,
    id: string,
    updates: { useForSummaries?: boolean; metadata?: Record<string, any> }
  ): Promise<Voice | undefined> {
    const [updated] = await db
      .update(voices)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(voices.id, id))
      .returning();

    return updated;
  }

  /**
   * Get global voice settings (singleton)
   */
  static async getGlobalSettings(
    db: NodePgDatabase<any>
  ): Promise<GlobalVoiceSettings | undefined> {
    return db.query.globalVoiceSettings.findFirst();
  }

  /**
   * Create or update global voice settings
   */
  static async upsertGlobalSettings(
    db: NodePgDatabase<any>,
    userVoiceId: string,
    assistantVoiceId: string,
    modelId?: string
  ): Promise<GlobalVoiceSettings> {
    const existing = await this.getGlobalSettings(db);

    if (existing) {
      const [updated] = await db
        .update(globalVoiceSettings)
        .set({
          userVoiceId,
          assistantVoiceId,
          modelId: modelId || null,
          updatedAt: new Date(),
        })
        .where(eq(globalVoiceSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(globalVoiceSettings)
        .values({
          userVoiceId,
          assistantVoiceId,
          modelId: modelId || null,
        })
        .returning();
      return created;
    }
  }

  /**
   * Get project voice settings
   */
  static async getProjectSettings(
    db: NodePgDatabase<any>,
    projectId: string
  ): Promise<ProjectVoiceSettings | undefined> {
    return db.query.projectVoiceSettings.findFirst({
      where: eq(projectVoiceSettings.projectId, projectId),
    });
  }

  /**
   * Create or update project voice settings
   */
  static async upsertProjectSettings(
    db: NodePgDatabase<any>,
    projectId: string,
    userVoiceId?: string,
    assistantVoiceId?: string
  ): Promise<ProjectVoiceSettings> {
    const existing = await this.getProjectSettings(db, projectId);

    if (existing) {
      const [updated] = await db
        .update(projectVoiceSettings)
        .set({
          userVoiceId: userVoiceId || existing.userVoiceId,
          assistantVoiceId: assistantVoiceId || existing.assistantVoiceId,
          updatedAt: new Date(),
        })
        .where(eq(projectVoiceSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(projectVoiceSettings)
        .values({
          projectId,
          userVoiceId: userVoiceId || null,
          assistantVoiceId: assistantVoiceId || null,
        })
        .returning();
      return created;
    }
  }

  /**
   * Get voice for a hook event (considering project settings hierarchy)
   * Returns project-specific voice if set, otherwise falls back to global settings
   */
  static async getVoiceForHookEvent(
    db: NodePgDatabase<any>,
    hookEventId: string,
    role: 'user' | 'assistant'
  ): Promise<Voice | undefined> {
    // Get hook event with project ID
    const hookEvent = await db.query.hookEvents.findFirst({
      where: (hookEvents, { eq }) => eq(hookEvents.id, hookEventId),
    });

    if (!hookEvent) {
      throw new Error(`Hook event not found: ${hookEventId}`);
    }

    // Try project settings first
    const projectSettings = await this.getProjectSettings(db, hookEvent.projectId);
    if (projectSettings) {
      const voiceId = role === 'user' ? projectSettings.userVoiceId : projectSettings.assistantVoiceId;
      if (voiceId) {
        const voice = await this.getVoiceById(db, voiceId);
        if (voice) return voice;
      }
    }

    // Fall back to global settings
    const globalSettings = await this.getGlobalSettings(db);
    if (!globalSettings) {
      throw new Error('No global voice settings configured');
    }

    const voiceId = role === 'user' ? globalSettings.userVoiceId : globalSettings.assistantVoiceId;
    return this.getVoiceById(db, voiceId);
  }

  /**
   * Sync models from provider API to database
   * Upserts models based on provider + externalId
   */
  static async syncModels(
    db: NodePgDatabase<any>,
    provider: VoiceProvider
  ): Promise<number> {
    if (!provider.syncModels) {
      return 0;
    }

    const modelsData = await provider.syncModels();

    for (const modelData of modelsData) {
      // Check if model already exists
      const existing = await db.query.models.findFirst({
        where: and(
          eq(models.provider, provider.getProviderName()),
          eq(models.externalId, modelData.externalId)
        ),
      });

      if (existing) {
        // Update existing model
        await db
          .update(models)
          .set({
            name: modelData.name,
            description: modelData.description,
            metadata: modelData.metadata,
          })
          .where(eq(models.id, existing.id));
      } else {
        // Insert new model
        await db.insert(models).values({
          externalId: modelData.externalId,
          name: modelData.name,
          description: modelData.description,
          provider: provider.getProviderName(),
          metadata: modelData.metadata,
        });
      }
    }

    return modelsData.length;
  }

  /**
   * Sync pronunciation dictionaries from provider API to database
   * Upserts dictionaries based on provider + externalId
   */
  static async syncPronunciationDictionaries(
    db: NodePgDatabase<any>,
    provider: VoiceProvider
  ): Promise<number> {
    if (!provider.syncPronunciationDictionaries) {
      return 0;
    }

    const dictionariesData = await provider.syncPronunciationDictionaries();

    for (const dictionaryData of dictionariesData) {
      // Check if dictionary already exists
      const existing = await db.query.pronunciationDictionaries.findFirst({
        where: and(
          eq(pronunciationDictionaries.provider, provider.getProviderName()),
          eq(pronunciationDictionaries.externalId, dictionaryData.externalId)
        ),
      });

      if (existing) {
        // Update existing dictionary
        await db
          .update(pronunciationDictionaries)
          .set({
            name: dictionaryData.name,
            description: dictionaryData.description,
            metadata: dictionaryData.metadata,
          })
          .where(eq(pronunciationDictionaries.id, existing.id));
      } else {
        // Insert new dictionary
        await db.insert(pronunciationDictionaries).values({
          externalId: dictionaryData.externalId,
          name: dictionaryData.name,
          description: dictionaryData.description,
          provider: provider.getProviderName(),
          metadata: dictionaryData.metadata,
        });
      }
    }

    return dictionariesData.length;
  }

  /**
   * Get usage statistics from provider
   */
  static async getUsageStats(
    db: NodePgDatabase<any>,
    provider: VoiceProvider
  ): Promise<UsageResponse | null> {
    if (!provider.getUsageStats) {
      return null;
    }

    return await provider.getUsageStats();
  }
}
