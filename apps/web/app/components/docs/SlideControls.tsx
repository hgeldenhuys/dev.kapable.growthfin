/**
 * Slide Controls Component
 * Controls for Reveal.js presentations
 */

import { useState, useEffect } from 'react';
import { Play, Pause, Maximize, Minimize, FileText, Clock } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/lib/utils';

export interface SlideControlsProps {
  totalSlides: number;
  currentSlide: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  onToggleNotes: () => void;
  isFullscreen: boolean;
  showNotes: boolean;
  className?: string;
}

export function SlideControls({
  totalSlides,
  currentSlide,
  isPlaying,
  onTogglePlay,
  onToggleFullscreen,
  onToggleNotes,
  isFullscreen,
  showNotes,
  className,
}: SlideControlsProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50',
        className
      )}
    >
      <div className="max-w-6xl mx-auto space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {currentSlide + 1} / {totalSlides}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              size="sm"
              variant="outline"
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause auto-advance' : 'Play auto-advance'}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </>
              )}
            </Button>

            {/* Timer */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-1 bg-muted rounded-md">
              <Clock className="h-4 w-4" />
              {formatTime(elapsedTime)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Speaker Notes */}
            <Button
              size="sm"
              variant={showNotes ? 'default' : 'outline'}
              onClick={onToggleNotes}
              title="Toggle speaker notes"
            >
              <FileText className="h-4 w-4 mr-1" />
              Notes
            </Button>

            {/* Fullscreen */}
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="h-4 w-4 mr-1" />
                  Exit
                </>
              ) : (
                <>
                  <Maximize className="h-4 w-4 mr-1" />
                  Fullscreen
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Keyboard shortcuts helper
export function KeyboardShortcuts() {
  return (
    <div className="fixed bottom-20 right-4 bg-background/95 backdrop-blur border rounded-lg p-4 text-sm space-y-2 shadow-lg">
      <div className="font-semibold mb-2">Keyboard Shortcuts</div>
      <div className="space-y-1 text-muted-foreground">
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-muted rounded">→</kbd>
          <span>Next slide</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-muted rounded">←</kbd>
          <span>Previous slide</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-muted rounded">Space</kbd>
          <span>Next slide</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-muted rounded">F</kbd>
          <span>Fullscreen</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-muted rounded">S</kbd>
          <span>Speaker notes</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd>
          <span>Exit fullscreen</span>
        </div>
      </div>
    </div>
  );
}
