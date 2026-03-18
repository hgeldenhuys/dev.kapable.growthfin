import React from 'react';
import { Play, Pause, SkipForward, Square, Volume2, VolumeX, Keyboard } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Slider } from '~/components/ui/slider';
import { useAudioPlayer } from './AudioPlayerProvider';

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayerControls() {
  const {
    currentTrack,
    playbackState,
    volume,
    position,
    duration,
    queue,
    play,
    pause,
    stop,
    next,
    seek,
    setVolume,
    setShowKeyboardHelp,
  } = useAudioPlayer();

  const [isMuted, setIsMuted] = React.useState(false);
  const [previousVolume, setPreviousVolume] = React.useState(volume);

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      pause();
    } else {
      play();
    }
  };

  const handleVolumeToggle = () => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    if (newVolume !== undefined) {
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (values: number[]) => {
    const newPosition = values[0];
    if (newPosition !== undefined) {
      seek(newPosition);
    }
  };

  const isDisabled = !currentTrack && queue.length === 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Current Track Info */}
      {currentTrack && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium truncate">
            {currentTrack.messagePreview}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatTime(position)} / {formatTime(duration)}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <Slider
        value={[position]}
        min={0}
        max={duration || 100}
        step={0.1}
        onValueChange={handleSeek}
        disabled={!currentTrack}
        className="w-full"
      />

      {/* Playback Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePlayPause}
            disabled={isDisabled}
          >
            {playbackState === 'playing' ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={stop}
            disabled={isDisabled}
            title="Stop and clear queue"
          >
            <Square className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={next}
            disabled={queue.length === 0}
            title="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowKeyboardHelp(true)}
            title="Keyboard shortcuts (?)"
            className="h-8 w-8"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          {queue.length > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              {queue.length} in queue
            </span>
          )}
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleVolumeToggle}
            className="h-8 w-8"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
