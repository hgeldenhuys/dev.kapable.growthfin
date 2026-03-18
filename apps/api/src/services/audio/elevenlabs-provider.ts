/**
 * ElevenLabs Voice Provider
 * Implementation of VoiceProvider for ElevenLabs TTS API
 */

import type {
  VoiceProvider,
  VoiceProviderResponse,
  ModelResponse,
  DictionaryResponse,
  UsageResponse,
} from './voice-provider.interface';
import type { VoiceProvider as VoiceProviderType } from '@agios/db/schema';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels: Record<string, string>;
  preview_url?: string;
  settings?: {
    stability?: number;
    similarity_boost?: number;
  };
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

interface ElevenLabsModel {
  model_id: string;
  name: string;
  description?: string;
  can_be_finetuned?: boolean;
  can_do_text_to_speech?: boolean;
  can_do_voice_conversion?: boolean;
  can_use_style?: boolean;
  can_use_speaker_boost?: boolean;
  serves_pro_voices?: boolean;
  token_cost_factor?: number;
  languages?: Array<{ language_id: string; name: string }>;
}

interface ElevenLabsModelsResponse {
  models?: ElevenLabsModel[];
}

interface ElevenLabsDictionary {
  id: string;
  name: string;
  description?: string;
  version_id?: string;
  created_date?: number;
}

interface ElevenLabsDictionariesResponse {
  pronunciation_dictionaries?: ElevenLabsDictionary[];
}

interface ElevenLabsSubscription {
  character_count?: number;
  character_limit?: number;
  can_extend_character_limit?: boolean;
  allowed_to_extend_character_limit?: boolean;
  next_character_count_reset_unix?: number;
  voice_limit?: number;
  professional_voice_limit?: number;
  can_extend_voice_limit?: boolean;
  can_use_instant_voice_cloning?: boolean;
  can_use_professional_voice_cloning?: boolean;
  currency?: string;
  status?: string;
  tier?: string;
}

/**
 * ElevenLabs Speech-to-Text (Scribe) response types
 * H.4 - Call Recording Transcription
 */
export interface ElevenLabsTranscriptionWord {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'spacing' | 'audio_event';
  speaker_id?: string;
  confidence?: number;
}

export interface ElevenLabsTranscriptionResult {
  text: string;
  language_code: string;
  language_probability: number;
  words: ElevenLabsTranscriptionWord[];
}

export class ElevenLabsProvider implements VoiceProvider {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    this.apiKey = apiKey;
  }

  getProviderName(): VoiceProviderType {
    return 'elevenlabs';
  }

  /**
   * Map ElevenLabs labels to gender
   * ElevenLabs uses labels like: { gender: "male", accent: "american", age: "young" }
   */
  private mapGender(labels: Record<string, string>): 'male' | 'female' | 'neutral' {
    const gender = labels['gender']?.toLowerCase();
    if (gender === 'male') return 'male';
    if (gender === 'female') return 'female';
    return 'neutral';
  }

  /**
   * Sync voices from ElevenLabs API
   */
  async syncVoices(): Promise<VoiceProviderResponse[]> {
    return this.getVoices();
  }

  /**
   * Get voices from ElevenLabs API
   */
  async getVoices(): Promise<VoiceProviderResponse[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ElevenLabsVoicesResponse;

    return data.voices.map((voice) => ({
      externalId: voice.voice_id,
      name: voice.name,
      gender: this.mapGender(voice.labels),
      metadata: {
        labels: voice.labels,
        previewUrl: voice.preview_url,
        settings: voice.settings,
      },
    }));
  }

  /**
   * Generate speech using ElevenLabs TTS API
   * @param text - Text to convert to speech
   * @param voiceId - ElevenLabs voice ID
   * @param modelId - Optional model ID (defaults to 'eleven_v3')
   * @returns MP3 audio buffer
   */
  async generateSpeech(text: string, voiceId: string, modelId?: string): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId || 'eleven_v3',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS error (${response.status}): ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Transcribe audio from a Buffer using ElevenLabs Scribe v2 API
   * Used for browser-recorded audio (voice chat input)
   *
   * @param audioBuffer - Raw audio buffer (e.g. webm from MediaRecorder)
   * @param filename - Filename hint for the upload (default: recording.webm)
   * @returns Transcription result with text
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    filename = 'recording.webm'
  ): Promise<ElevenLabsTranscriptionResult> {
    const mimeType = filename.endsWith('.webm') ? 'audio/webm' : 'audio/mpeg';
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
    formData.append('model_id', 'scribe_v2');

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs STT error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<ElevenLabsTranscriptionResult>;
  }

  /**
   * Transcribe audio using ElevenLabs Scribe v2 API (H.4 - Call Transcription)
   *
   * Downloads audio from URL and sends to ElevenLabs for transcription with:
   * - Speaker diarization (up to 32 speakers)
   * - Word-level timestamps
   * - Audio event tagging
   *
   * @param audioUrl - URL of the audio file to transcribe (Twilio recording URL)
   * @param twilioCredentials - Optional Twilio credentials for authenticated download
   * @returns Transcription result with text, words, and speaker diarization
   */
  async transcribeAudio(
    audioUrl: string,
    twilioCredentials?: { accountSid: string; authToken: string }
  ): Promise<ElevenLabsTranscriptionResult> {
    console.log(`[ElevenLabs] Downloading audio from: ${audioUrl}`);

    // Download audio from Twilio (requires authentication)
    // Twilio recording URLs need .mp3 suffix for MP3 format
    const downloadUrl = audioUrl.endsWith('.mp3') ? audioUrl : `${audioUrl}.mp3`;

    const headers: HeadersInit = {};
    if (twilioCredentials) {
      const auth = Buffer.from(`${twilioCredentials.accountSid}:${twilioCredentials.authToken}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const audioResponse = await fetch(downloadUrl, { headers });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    console.log(`[ElevenLabs] Downloaded audio: ${audioBuffer.byteLength} bytes`);

    // Create form data for transcription request
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model_id', 'scribe_v2');
    formData.append('diarize', 'true');
    formData.append('timestamps_granularity', 'word');
    formData.append('tag_audio_events', 'true');

    console.log(`[ElevenLabs] Sending transcription request...`);

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`ElevenLabs transcription error (${response.status}): ${errorMessage}`);
    }

    const result = await response.json() as ElevenLabsTranscriptionResult;

    console.log(`[ElevenLabs] Transcription complete:`, {
      textLength: result.text.length,
      wordCount: result.words.length,
      language: result.language_code,
      confidence: result.language_probability,
    });

    return result;
  }

  /**
   * Sync models from ElevenLabs API
   */
  async syncModels(): Promise<ModelResponse[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ElevenLabsModel[];

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((model) => ({
      externalId: model.model_id,
      name: model.name,
      description: model.description,
      metadata: {
        canBeFinetuned: model.can_be_finetuned,
        canDoTextToSpeech: model.can_do_text_to_speech,
        canDoVoiceConversion: model.can_do_voice_conversion,
        canUseStyle: model.can_use_style,
        canUseSpeakerBoost: model.can_use_speaker_boost,
        servesProVoices: model.serves_pro_voices,
        tokenCostFactor: model.token_cost_factor,
        languages: model.languages,
      },
    }));
  }

  /**
   * Sync pronunciation dictionaries from ElevenLabs API
   */
  async syncPronunciationDictionaries(): Promise<DictionaryResponse[]> {
    const response = await fetch(`${this.baseUrl}/pronunciation-dictionaries`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ElevenLabsDictionariesResponse;

    if (!data.pronunciation_dictionaries || !Array.isArray(data.pronunciation_dictionaries)) {
      return [];
    }

    return data.pronunciation_dictionaries.map((dict) => ({
      externalId: dict.id,
      name: dict.name,
      description: dict.description,
      metadata: {
        versionId: dict.version_id,
        createdDate: dict.created_date,
      },
    }));
  }

  /**
   * Get usage statistics from ElevenLabs API
   */
  async getUsageStats(): Promise<UsageResponse> {
    const response = await fetch(`${this.baseUrl}/user/subscription`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ElevenLabsSubscription;

    return {
      charactersUsed: data.character_count || 0,
      characterLimit: data.character_limit || 0,
    };
  }
}
