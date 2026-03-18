/**
 * Voice Types for TTS Audio Narration System
 */

export type VoiceGender = 'male' | 'female' | 'neutral';

export interface Voice {
  id: string;
  provider: string;
  externalId: string;
  name: string;
  gender: VoiceGender;
  useForSummaries: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  externalId: string;
  name: string;
  description: string | null;
  provider: string;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface GlobalVoiceSettings {
  id: string;
  userVoiceId: string | null;
  assistantVoiceId: string | null;
  modelId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateVoiceDto {
  useForSummaries?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateGlobalVoiceSettingsDto {
  userVoiceId: string;
  assistantVoiceId: string;
  modelId?: string;
}
