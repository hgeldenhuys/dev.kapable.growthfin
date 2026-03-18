/**
 * Audio Preview Button Component
 * Inline audio player for voice preview in audio management
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface AudioPreviewButtonProps {
  voiceName: string;
  previewUrl?: string;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'error';

// Global audio instance to ensure single playback
let globalAudioInstance: HTMLAudioElement | null = null;
let globalCleanupCallback: (() => void) | null = null;

export function AudioPreviewButton({ voiceName, previewUrl }: AudioPreviewButtonProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Cleanup function
  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (globalAudioInstance === audioRef.current) {
      globalAudioInstance = null;
      globalCleanupCallback = null;
    }
    setPlaybackState('idle');
    setErrorMessage(''); // Clear any error messages when cleaning up
  };

  // Handle play/pause
  const handlePlayPause = async () => {
    // No preview URL available
    if (!previewUrl) {
      setErrorMessage('No preview available');
      setPlaybackState('error');
      return;
    }

    // If currently playing, pause
    if (playbackState === 'playing') {
      cleanup();
      return;
    }

    // Stop any other audio playing
    if (globalCleanupCallback && globalCleanupCallback !== cleanup) {
      globalCleanupCallback();
    }

    // Set loading state
    setPlaybackState('loading');
    setErrorMessage('');

    try {
      // Create new audio element
      const audio = new Audio();
      audioRef.current = audio;
      globalAudioInstance = audio;
      globalCleanupCallback = cleanup;
      let hasStartedPlaying = false;

      // Set up event listeners
      audio.addEventListener('canplay', () => {
        hasStartedPlaying = true;
        setPlaybackState('playing');
      });

      audio.addEventListener('ended', () => {
        cleanup();
      });

      audio.addEventListener('error', (e) => {
        // Only show error if audio hasn't started playing yet (load error, not pause error)
        if (!hasStartedPlaying) {
          setErrorMessage('Failed to load audio');
          setPlaybackState('error');
        }
      });

      // Load and play
      audio.src = previewUrl;
      await audio.play();
    } catch (error) {
      // Error is handled gracefully with UI feedback
      setErrorMessage('Playback failed');
      setPlaybackState('error');
      cleanup();
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePlayPause();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Determine icon and styling based on state
  const getIcon = () => {
    switch (playbackState) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'playing':
        return <Pause className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  // If no preview URL, show disabled state
  if (!previewUrl) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Volume2 className="h-4 w-4" />
        <span className="text-sm">{voiceName}</span>
        <span className="text-xs italic">(No preview)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8',
          playbackState === 'playing' && 'bg-primary/10 text-primary',
          playbackState === 'error' && 'text-destructive'
        )}
        onClick={handlePlayPause}
        onKeyDown={handleKeyDown}
        disabled={playbackState === 'loading'}
        aria-label={`${playbackState === 'playing' ? 'Pause' : 'Play'} audio preview for ${voiceName}`}
        title={errorMessage || `Preview ${voiceName}`}
      >
        {getIcon()}
      </Button>
      <span className="text-sm font-medium">
        {voiceName}
        {playbackState === 'playing' && (
          <span className="ml-2 text-xs text-muted-foreground">(playing)</span>
        )}
      </span>
      {playbackState === 'error' && errorMessage && (
        <span className="text-xs text-destructive">{errorMessage}</span>
      )}
    </div>
  );
}
