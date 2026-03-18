/**
 * Transcribe Recording Worker (H.4 - Call Recording & Transcription)
 *
 * Processes Twilio call recordings through ElevenLabs Scribe v2 for transcription.
 * Features:
 * - Speaker diarization (identifies different speakers)
 * - Word-level timestamps
 * - Audio event tagging
 *
 * The worker downloads the recording from Twilio, sends it to ElevenLabs,
 * and stores the transcription result in the activity's channelMetadata.
 */

import { db } from '@agios/db/client';
import { jobQueue, type TranscribeRecordingJob } from '../lib/queue';
import { ElevenLabsProvider, type ElevenLabsTranscriptionWord } from '../services/audio/elevenlabs-provider';
import { voiceActivityService } from '../modules/crm/services/voice-activity';
import { timelineService } from '../modules/crm/services/timeline';
import { env } from '../config/env';

/**
 * Extract speaker segments from word-level transcription
 *
 * Groups consecutive words by speaker into segments for easier display.
 * Each segment represents a continuous utterance from one speaker.
 */
function extractSpeakerSegments(words: ElevenLabsTranscriptionWord[]) {
  const speakers: Record<
    string,
    { segments: Array<{ start: number; end: number; text: string }> }
  > = {};

  let currentSpeaker: string | null = null;
  let currentSegment: { start: number; end: number; text: string } | null = null;

  for (const word of words) {
    // Skip non-word tokens (spacing, audio events)
    if (word.type !== 'word') continue;

    const speakerId = word.speaker_id || 'unknown';

    if (speakerId !== currentSpeaker) {
      // Save previous segment
      if (currentSegment && currentSpeaker) {
        const sp = speakers[currentSpeaker] ?? { segments: [] };
        sp.segments.push(currentSegment);
        speakers[currentSpeaker] = sp;
      }

      // Start new segment
      currentSpeaker = speakerId;
      currentSegment = { start: word.start, end: word.end, text: word.text };
    } else if (currentSegment) {
      // Continue current segment
      currentSegment.end = word.end;
      currentSegment.text += ' ' + word.text;
    }
  }

  // Save last segment
  if (currentSegment && currentSpeaker) {
    const sp = speakers[currentSpeaker] ?? { segments: [] };
    sp.segments.push(currentSegment);
    speakers[currentSpeaker] = sp;
  }

  return Object.entries(speakers).map(([id, data]) => ({
    speakerId: id,
    segments: data.segments,
  }));
}

/**
 * Register the transcription worker
 */
export async function registerTranscribeRecordingWorker() {
  await jobQueue.work<TranscribeRecordingJob>(
    'transcribe-recording',
    {
      teamSize: 2, // Process 2 recordings in parallel
      teamConcurrency: 1,
    },
    async (job) => {
      const { callSid, recordingUrl, recordingSid, workspaceId, leadId, contactId } = job.data;

      console.log(`[Transcribe] Processing recording for CallSid: ${callSid}`);
      console.log(`[Transcribe] Recording URL: ${recordingUrl}`);
      console.log(`[Transcribe] Recording SID: ${recordingSid}`);

      // Check for ElevenLabs API key
      const apiKey = env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.error(`[Transcribe] ELEVENLABS_API_KEY not configured`);
        await voiceActivityService.updateCallTranscription(db, callSid, {
          status: 'failed',
          error: 'ELEVENLABS_API_KEY not configured',
        });
        throw new Error('ELEVENLABS_API_KEY not configured');
      }

      // Mark transcription as processing
      await voiceActivityService.updateCallTranscription(db, callSid, {
        status: 'processing',
      });

      try {
        const provider = new ElevenLabsProvider(apiKey);

        // Download and transcribe the recording
        // Twilio recordings require authentication
        const twilioAccountSid = process.env['TWILIO_ACCOUNT_SID'];
        const twilioAuthToken = process.env['TWILIO_AUTH_TOKEN'];
        const twilioCredentials = twilioAccountSid && twilioAuthToken
          ? { accountSid: twilioAccountSid, authToken: twilioAuthToken }
          : undefined;

        const result = await provider.transcribeAudio(recordingUrl, twilioCredentials);

        // Extract speaker segments for diarization display
        const speakers = extractSpeakerSegments(result.words);

        // Filter words to only include actual words (not spacing/events)
        const wordData = result.words
          .filter((w) => w.type === 'word')
          .map((w) => ({
            text: w.text,
            start: w.start,
            end: w.end,
            speakerId: w.speaker_id,
            confidence: w.confidence,
          }));

        // Update activity with transcription data
        await voiceActivityService.updateCallTranscription(db, callSid, {
          status: 'completed',
          text: result.text,
          language: result.language_code,
          languageConfidence: result.language_probability,
          speakers,
          words: wordData,
          provider: 'elevenlabs',
          model: 'scribe_v2',
        });

        // Create timeline event for transcription completion
        if (workspaceId && (leadId || contactId)) {
          await timelineService.create(db, {
            workspaceId,
            entityType: leadId ? 'lead' : 'contact',
            entityId: (leadId || contactId)!,
            eventType: 'activity.call_transcribed',
            eventCategory: 'communication',
            eventLabel: 'Call Transcribed',
            summary: `Call transcription completed (${result.words.filter((w) => w.type === 'word').length} words, ${speakers.length} speakers)`,
            occurredAt: new Date(),
            actorType: 'system',
            metadata: {
              provider: 'elevenlabs',
              model: 'scribe_v2',
              wordCount: wordData.length,
              speakerCount: speakers.length,
              language: result.language_code,
              languageConfidence: result.language_probability,
            },
          });
        }

        console.log(`[Transcribe] Completed for CallSid: ${callSid}`);
        console.log(`[Transcribe] Words: ${wordData.length}, Speakers: ${speakers.length}`);
      } catch (error) {
        console.error(`[Transcribe] Failed for CallSid: ${callSid}`, error);

        // Mark transcription as failed
        await voiceActivityService.updateCallTranscription(db, callSid, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });

        // Re-throw to let pg-boss handle retry
        throw error;
      }
    }
  );

  console.log('[Transcribe] Recording worker registered');
}
