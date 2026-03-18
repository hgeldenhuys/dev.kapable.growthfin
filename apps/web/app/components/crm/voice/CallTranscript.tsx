/**
 * CallTranscript Component (H.4 - Call Recording & Transcription)
 *
 * Displays call recording audio player and transcription with speaker diarization.
 * Shows different states: pending, processing, completed, failed.
 */

import { useState } from 'react';
import { Loader2, AlertCircle, ChevronDown, ChevronUp, FileText, Users } from 'lucide-react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { SpeakerSegments } from './SpeakerSegments';

interface RecordingData {
  sid: string;
  url: string;
  duration: number;
  status: string;
  recordedAt: string;
}

interface TranscriptionData {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  language?: string;
  languageConfidence?: number;
  provider?: string;
  model?: string;
  processedAt?: string;
  error?: string;
  speakers?: Array<{
    speakerId: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}

interface CallTranscriptProps {
  recording?: RecordingData;
  transcription?: TranscriptionData;
  className?: string;
}

/**
 * Format duration seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function CallTranscript({ recording, transcription, className }: CallTranscriptProps) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showSpeakers, setShowSpeakers] = useState(true);

  // If no recording, don't render anything
  if (!recording) {
    return null;
  }

  const hasSpeakers = transcription?.speakers && transcription.speakers.length > 0;
  const hasFullText = transcription?.text && transcription.text.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Audio Player */}
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
        <audio
          controls
          src={`${recording.url}.mp3`}
          className="flex-1 h-8"
          preload="metadata"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDuration(recording.duration)}
        </span>
      </div>

      {/* Transcription Status */}
      {transcription?.status === 'pending' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Transcription pending...</span>
        </div>
      )}

      {transcription?.status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Transcribing audio...</span>
        </div>
      )}

      {transcription?.status === 'failed' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Transcription failed{transcription.error ? `: ${transcription.error}` : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Transcription Content */}
      {transcription?.status === 'completed' && (
        <div className="space-y-3">
          {/* Language Badge */}
          {transcription.language && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="uppercase font-medium">{transcription.language}</span>
              {transcription.languageConfidence && (
                <span>({Math.round(transcription.languageConfidence * 100)}% confidence)</span>
              )}
            </div>
          )}

          {/* View Toggle Buttons */}
          {hasSpeakers && hasFullText && (
            <div className="flex gap-2">
              <Button
                variant={showSpeakers ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowSpeakers(true)}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Speakers
              </Button>
              <Button
                variant={!showSpeakers ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowSpeakers(false)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Full Text
              </Button>
            </div>
          )}

          {/* Speaker Segments View */}
          {showSpeakers && hasSpeakers && (
            <SpeakerSegments speakers={transcription.speakers!} />
          )}

          {/* Full Transcript View */}
          {(!showSpeakers || !hasSpeakers) && hasFullText && (
            <div className="space-y-2">
              <div
                className={cn(
                  'p-3 bg-muted rounded text-sm whitespace-pre-wrap',
                  !showFullTranscript && 'line-clamp-5'
                )}
              >
                {transcription.text}
              </div>
              {transcription.text!.length > 300 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="gap-1"
                >
                  {showFullTranscript ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show more
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CallTranscript;
