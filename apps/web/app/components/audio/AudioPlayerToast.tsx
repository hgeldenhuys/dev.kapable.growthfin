import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useAudioPlayer } from './AudioPlayerProvider';

export function AudioPlayerToast() {
  const {
    currentTrack,
    playbackState,
    queue,
    isPanelOpen,
    play,
    pause,
    next,
    togglePanel,
  } = useAudioPlayer();

  // Don't show toast if panel is open or nothing is playing
  if (isPanelOpen || (!currentTrack && queue.length === 0)) {
    return null;
  }

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playbackState === 'playing') {
      pause();
    } else {
      play();
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    next();
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-3 max-w-sm cursor-pointer hover:shadow-xl transition-shadow"
      onClick={togglePanel}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {currentTrack?.messagePreview || 'Audio Player'}
          </p>
          <p className="text-xs text-muted-foreground">
            {playbackState === 'playing' ? 'Playing' : 'Paused'}
            {queue.length > 0 && ` • ${queue.length} in queue`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePlayPause}
          >
            {playbackState === 'playing' ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {queue.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
