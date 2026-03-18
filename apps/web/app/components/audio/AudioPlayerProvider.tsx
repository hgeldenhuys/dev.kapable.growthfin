import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from '~/hooks/useKeyboardShortcuts';
import { toast } from 'sonner';

export interface AudioQueueItem {
  id: string;
  messageId: string;
  messagePreview: string;
  audioUrl: string;
  addedAt: Date;
}

export type PlaybackState = 'idle' | 'playing' | 'paused';

interface AudioPlayerState {
  queue: AudioQueueItem[];
  currentTrack: AudioQueueItem | null;
  playbackState: PlaybackState;
  volume: number;
  position: number;
  duration: number;
  isPanelOpen: boolean;
  isMuted: boolean;
}

interface AudioPlayerContextValue extends AudioPlayerState {
  addToQueue: (item: Omit<AudioQueueItem, 'id' | 'addedAt'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  play: () => void;
  pause: () => void;
  playPause: () => void;
  stop: () => void;
  next: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  increaseVolume: (amount: number) => void;
  decreaseVolume: (amount: number) => void;
  toggleMute: () => void;
  togglePanel: () => void;
  setShowKeyboardHelp: (show: boolean) => void;
  showKeyboardHelp: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const MAX_QUEUE_SIZE = 50;
const VOLUME_STORAGE_KEY = 'agios-audio-player-volume';
const QUEUE_STORAGE_KEY = 'agios-audio-player-queue';
const STATE_STORAGE_KEY = 'agios-audio-player-state';
const FIRST_USE_KEY = 'agios-audio-player-first-use';

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<AudioQueueItem[]>([]);
  const [currentTrack, setCurrentTrack] = useState<AudioQueueItem | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [volume, setVolumeState] = useState<number>(1);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    // Load persisted volume
    const savedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      setVolumeState(vol);
      audio.volume = vol;
    }

    // Load persisted queue and state
    const savedQueue = sessionStorage.getItem(QUEUE_STORAGE_KEY);
    const savedState = sessionStorage.getItem(STATE_STORAGE_KEY);

    if (savedQueue) {
      try {
        const parsedQueue = JSON.parse(savedQueue);
        setQueue(parsedQueue.map((item: AudioQueueItem) => ({
          ...item,
          addedAt: new Date(item.addedAt)
        })));
      } catch (error) {
        console.error('Failed to restore queue:', error);
      }
    }

    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.currentTrack) {
          setCurrentTrack({
            ...parsedState.currentTrack,
            addedAt: new Date(parsedState.currentTrack.addedAt)
          });
        }
      } catch (error) {
        console.error('Failed to restore state:', error);
      }
    }

    // Event listeners
    const handleTimeUpdate = () => {
      setPosition(audio.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setPlaybackState('idle');
      // Auto-advance to next track
      playNextTrack();
    };

    const handlePlay = () => {
      setPlaybackState('playing');
    };

    const handlePause = () => {
      setPlaybackState('paused');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Persist queue to sessionStorage
  useEffect(() => {
    if (queue.length > 0) {
      sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } else {
      sessionStorage.removeItem(QUEUE_STORAGE_KEY);
    }
  }, [queue]);

  // Persist current track to sessionStorage
  useEffect(() => {
    if (currentTrack) {
      sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ currentTrack }));
    } else {
      sessionStorage.removeItem(STATE_STORAGE_KEY);
    }
  }, [currentTrack]);

  const playNextTrack = () => {
    if (queue.length === 0) {
      setCurrentTrack(null);
      setPlaybackState('idle');
      return;
    }

    const nextTrack = queue[0];
    if (!nextTrack) {
      setCurrentTrack(null);
      setPlaybackState('idle');
      return;
    }

    setCurrentTrack(nextTrack);
    setQueue((prev) => prev.slice(1));

    if (audioRef.current) {
      audioRef.current.src = nextTrack.audioUrl;
      audioRef.current.play().catch((error) => {
        console.error('Failed to play audio:', error);
        setPlaybackState('idle');
      });
    }
  };

  const addToQueue = (item: Omit<AudioQueueItem, 'id' | 'addedAt'>) => {
    const newItem: AudioQueueItem = {
      ...item,
      id: `${item.messageId}-${Date.now()}`,
      addedAt: new Date(),
    };

    // Check if nothing is currently playing - if so, set as currentTrack instead of queueing
    if (!currentTrack && playbackState === 'idle') {
      // Don't add to queue - set directly as currentTrack
      setCurrentTrack(newItem);
      if (audioRef.current) {
        audioRef.current.src = newItem.audioUrl;
        // Don't call play() here - user must click play button in controls
      }
      setPlaybackState('paused'); // Set to paused so user can click play
    } else {
      // Something is already playing/paused - add to queue for later
      setQueue((prev) => {
        // Prevent duplicates: check if messageId already exists in queue or is currently playing
        const isDuplicate = prev.some(queueItem => queueItem.messageId === item.messageId);
        const isCurrentlyPlaying = currentTrack?.messageId === item.messageId;

        if (isDuplicate || isCurrentlyPlaying) {
          return prev; // Don't add duplicate
        }

        const newQueue = [...prev, newItem];
        // Enforce max queue size (FIFO)
        return newQueue.slice(-MAX_QUEUE_SIZE);
      });
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentTrack(null);
    setPlaybackState('idle');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const play = () => {
    if (audioRef.current) {
      if (currentTrack) {
        audioRef.current.play().catch((error) => {
          console.error('Failed to play audio:', error);
        });
      } else if (queue.length > 0) {
        playNextTrack();
      }
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const playPause = () => {
    if (playbackState === 'playing') {
      pause();
    } else {
      play();
    }
  };

  const stop = () => {
    clearQueue();
  };

  const next = () => {
    playNextTrack();
  };

  const seek = (newPosition: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newPosition;
      setPosition(newPosition);
    }
  };

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    localStorage.setItem(VOLUME_STORAGE_KEY, clampedVolume.toString());
    // If setting volume > 0, unmute
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const increaseVolume = (amount: number) => {
    const newVolume = Math.min(1, volume + amount);
    setVolume(newVolume);
  };

  const decreaseVolume = (amount: number) => {
    const newVolume = Math.max(0, volume - amount);
    setVolume(newVolume);
  };

  const toggleMute = () => {
    if (isMuted) {
      // Unmute - restore previous volume
      setVolume(volumeBeforeMute);
      setIsMuted(false);
    } else {
      // Mute - save current volume and set to 0
      setVolumeBeforeMute(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const togglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  // Show first-use hint when user first plays audio
  useEffect(() => {
    if (playbackState === 'playing') {
      const hasSeenHint = localStorage.getItem(FIRST_USE_KEY);
      if (!hasSeenHint) {
        toast.info('💡 Tip: Use Space to play/pause, ? for all keyboard shortcuts', {
          duration: 5000,
        });
        localStorage.setItem(FIRST_USE_KEY, 'true');
      }
    }
  }, [playbackState]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: ' ',
      action: playPause,
      description: 'Play/Pause',
    },
    {
      key: 'n',
      action: next,
      description: 'Next track',
    },
    {
      key: 's',
      action: stop,
      description: 'Stop playback',
    },
    {
      key: 'ArrowUp',
      action: () => increaseVolume(0.1),
      description: 'Volume +10%',
    },
    {
      key: 'ArrowDown',
      action: () => decreaseVolume(0.1),
      description: 'Volume -10%',
    },
    {
      key: 'm',
      action: toggleMute,
      description: 'Mute/Unmute',
    },
    {
      key: 'p',
      action: togglePanel,
      description: 'Toggle player panel',
    },
    {
      key: 'Escape',
      action: () => {
        if (isPanelOpen) {
          setIsPanelOpen(false);
        }
      },
      description: 'Close panel',
    },
    {
      key: '?',
      action: () => setShowKeyboardHelp(true),
      description: 'Show keyboard shortcuts',
    },
  ]);

  const value: AudioPlayerContextValue = {
    queue,
    currentTrack,
    playbackState,
    volume,
    position,
    duration,
    isPanelOpen,
    isMuted,
    showKeyboardHelp,
    addToQueue,
    removeFromQueue,
    clearQueue,
    play,
    pause,
    playPause,
    stop,
    next,
    seek,
    setVolume,
    increaseVolume,
    decreaseVolume,
    toggleMute,
    togglePanel,
    setShowKeyboardHelp,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return context;
}
