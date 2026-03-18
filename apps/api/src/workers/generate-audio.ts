/**
 * Generate Audio Worker
 * Generates audio files from text using TTS providers
 */

import { db } from '@agios/db/client';
import { audioCache, voices, models, globalVoiceSettings } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue, type GenerateAudioJob } from '../lib/queue';
import { ElevenLabsProvider } from '../services/audio/elevenlabs-provider';
import { env } from '../config/env';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Preprocess text to make it TTS-friendly by converting slash commands to natural language.
 *
 * Pattern transformations:
 * - `/namespace:command` → "namespace command command"
 * - `/command` → "command command"
 *
 * @param text - Original text containing slash commands
 * @returns Text with commands converted to natural language
 *
 * @example
 * preprocessTextForTTS('/sdlc:start') // => 'sdlc start command'
 * preprocessTextForTTS('/requirement') // => 'requirement command'
 * preprocessTextForTTS('Use /sdlc:start to begin') // => 'Use sdlc start command to begin'
 */
export function preprocessTextForTTS(text: string): string {
  // Only match slash commands that appear to be actual commands, not file paths or URLs
  // Commands must:
  // 1. Be preceded by whitespace or start of string (not alphanumeric or /)
  // 2. Consist of lowercase letters and hyphens only
  // 3. Not be part of a longer path (no alphanumeric after)

  // Replace /namespace:command with "namespace command command"
  // Must be preceded by non-alphanumeric (or start of string)
  text = text.replace(/(^|[^a-zA-Z0-9/.])\/([a-z-]+):([a-z-]+)/g, '$1$2 $3 command');

  // Replace /command with "command command"
  // Must be preceded by non-alphanumeric and not followed by alphanumeric/path chars
  text = text.replace(/(^|[^a-zA-Z0-9/.])\/([a-z-]+)(?![a-zA-Z0-9/.])/g, '$1$2 command');

  return text;
}

export async function registerGenerateAudioWorker() {
  await jobQueue.work<GenerateAudioJob>(
    'generate-audio',
    {
      teamSize: 2, // Process 2 audio files in parallel
      teamConcurrency: 1,
    },
    async (job) => {
      const { hookEventId, voiceId, text, role } = job.data;

      console.log(`🔊 Generating audio for event ${hookEventId} with voice ${voiceId} (${role})`);
      console.log(`🎙️ Text to speak (${text.length} chars): "${text.substring(0, 100)}..."`);

      // 0. Preprocess text to make it TTS-friendly
      const processedText = preprocessTextForTTS(text);
      if (processedText !== text) {
        console.log(`🔄 Preprocessed text for TTS (commands converted to natural language)`);
      }

      // 1. Get voice from DB
      const voice = await db.query.voices.findFirst({
        where: eq(voices.id, voiceId),
      });

      if (!voice) {
        throw new Error(`Voice not found: ${voiceId}`);
      }

      // 2. Get model from global settings
      const settings = await db.query.globalVoiceSettings.findFirst();
      let modelId = 'eleven_v3'; // Default fallback

      if (settings?.modelId) {
        const model = await db.query.models.findFirst({
          where: eq(models.id, settings.modelId),
        });
        if (model) {
          modelId = model.externalId;
          console.log(`[Audio Worker] Using model: ${model.name} (${modelId})`);
        } else {
          console.log(`[Audio Worker] Model not found, using fallback: ${modelId}`);
        }
      } else {
        console.log(`[Audio Worker] No model configured, using fallback: ${modelId}`);
      }

      // 3. Generate speech via provider
      let audioBuffer: Buffer;

      switch (voice.provider) {
        case 'elevenlabs':
          if (!env.ELEVENLABS_API_KEY) {
            throw new Error('ELEVENLABS_API_KEY not configured');
          }
          const provider = new ElevenLabsProvider(env.ELEVENLABS_API_KEY);
          audioBuffer = await provider.generateSpeech(processedText, voice.externalId, modelId);
          break;

        case 'openai-tts':
          throw new Error('OpenAI TTS provider not implemented yet');

        default:
          throw new Error(`Unsupported voice provider: ${voice.provider}`);
      }

      // 4. Save to file system (in public/cdn/audio directory)
      const audioDir = join(process.cwd(), 'public', 'cdn', 'audio');
      await mkdir(audioDir, { recursive: true });

      const filename = `${hookEventId}-${voiceId}.mp3`; // Idempotent: hook_event_id + voice_id
      const audioPath = join(audioDir, filename);

      await writeFile(audioPath, audioBuffer);

      console.log(`💾 Saved audio file to: ${audioPath}`);

      // 5. Cache entry with relative URL
      const relativeUrl = `/cdn/audio/${filename}`; // Served via API

      // Insert once - UNIQUE constraint on (hook_event_id, voice_id) prevents duplicates
      const insertResult = await db
        .insert(audioCache)
        .values({
          hookEventId,
          role,
          voiceId,
          url: relativeUrl,
          text: processedText, // Store the LLM-prepared text that was sent to TTS (not original)
          duration: null,
        })
        .onConflictDoNothing()
        .returning({ id: audioCache.id }); // Get the ID of the inserted record

      // If no record was inserted (conflict), skip the notification
      if (insertResult.length === 0) {
        console.log(`⏭️  Skipped duplicate audio for ${hookEventId} with voice ${voiceId}`);
        return;
      }

      const cacheId = insertResult[0].id;

      // Real-time event is handled automatically by SignalDB's table triggers
      // on the audio_cache table INSERT above — no manual pg_notify needed.
      console.log(`✅ Generated audio for ${hookEventId} with voice ${voiceId}`);
    }
  );

  console.log('✅ Generate Audio worker registered');
}
