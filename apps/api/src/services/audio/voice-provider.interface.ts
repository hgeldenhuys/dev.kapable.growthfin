/**
 * Voice Provider Interface
 * Abstraction for different TTS providers (ElevenLabs, OpenAI, etc.)
 */

import type { Voice, VoiceProvider as VoiceProviderType } from '@agios/db/schema';

export interface VoiceProviderResponse {
  externalId: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  metadata?: Record<string, any>;
}

export interface ModelResponse {
  externalId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface DictionaryResponse {
  externalId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UsageResponse {
  charactersUsed: number;
  characterLimit: number;
}

export interface VoiceProvider {
  /**
   * Get provider name
   */
  getProviderName(): VoiceProviderType;

  /**
   * Sync voices from provider API
   * Fetches available voices and returns normalized data
   */
  syncVoices(): Promise<VoiceProviderResponse[]>;

  /**
   * Generate speech from text
   * @param text - Text to convert to speech
   * @param voiceId - Provider's voice ID (external ID)
   * @param modelId - Optional model ID (defaults to provider-specific default)
   * @returns Audio buffer (MP3)
   */
  generateSpeech(text: string, voiceId: string, modelId?: string): Promise<Buffer>;

  /**
   * Get voices from provider (without saving to DB)
   * Useful for testing/previewing voices
   */
  getVoices(): Promise<VoiceProviderResponse[]>;

  /**
   * Sync models from provider API (optional)
   */
  syncModels?(): Promise<ModelResponse[]>;

  /**
   * Sync pronunciation dictionaries from provider API (optional)
   */
  syncPronunciationDictionaries?(): Promise<DictionaryResponse[]>;

  /**
   * Get usage statistics from provider (optional)
   */
  getUsageStats?(): Promise<UsageResponse>;
}
