/**
 * SpeakerSegments Component (H.4 - Call Transcription)
 *
 * Displays call transcription with speaker diarization.
 * Each speaker is color-coded and segments are shown chronologically.
 */

import { cn } from '~/lib/utils';

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface Speaker {
  speakerId: string;
  segments: Segment[];
}

interface SpeakerSegmentsProps {
  speakers: Speaker[];
  className?: string;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Speaker colors for visual differentiation
 */
const SPEAKER_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
  'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
  'bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800',
  'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800',
];

const SPEAKER_TEXT_COLORS = [
  'text-blue-700 dark:text-blue-300',
  'text-green-700 dark:text-green-300',
  'text-purple-700 dark:text-purple-300',
  'text-orange-700 dark:text-orange-300',
  'text-pink-700 dark:text-pink-300',
  'text-cyan-700 dark:text-cyan-300',
];

export function SpeakerSegments({ speakers, className }: SpeakerSegmentsProps) {
  // Flatten and sort segments by start time for chronological display
  const timeline = speakers
    .flatMap((s) =>
      s.segments.map((seg) => ({ ...seg, speakerId: s.speakerId }))
    )
    .sort((a, b) => a.start - b.start);

  // Create a speaker index map for consistent coloring
  const speakerIndexMap = new Map<string, number>();
  speakers.forEach((s, i) => {
    speakerIndexMap.set(s.speakerId, i);
  });

  return (
    <div className={cn('space-y-2', className)}>
      {timeline.map((segment, i) => {
        const speakerIndex = speakerIndexMap.get(segment.speakerId) ?? 0;
        const colorClass = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
        const textColorClass = SPEAKER_TEXT_COLORS[speakerIndex % SPEAKER_TEXT_COLORS.length];

        return (
          <div
            key={`${segment.speakerId}-${i}`}
            className={cn('p-3 rounded-lg border', colorClass)}
          >
            <div className="flex justify-between text-xs mb-1">
              <span className={cn('font-medium', textColorClass)}>
                Speaker {speakerIndex + 1}
              </span>
              <span className="text-muted-foreground">
                {formatTime(segment.start)} - {formatTime(segment.end)}
              </span>
            </div>
            <p className="text-sm">{segment.text}</p>
          </div>
        );
      })}
    </div>
  );
}

export default SpeakerSegments;
