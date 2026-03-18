/**
 * Voice Recorder Hook
 * Wraps browser MediaRecorder API for audio capture
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  cancelRecording: () => void;
  error: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((blob: Blob) => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    resolveRef.current = null;
    setDuration(0);
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop tracks AFTER final data is flushed — doing it earlier
        // kills the audio pipeline before ondataavailable fires
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop();
          }
          streamRef.current = null;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
      };

      recorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);

      // Track duration
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError(message);
      }
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        reject(new Error('Not recording'));
        return;
      }
      resolveRef.current = resolve;
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Don't stop stream tracks here — the onstop handler does it
      // after the final ondataavailable event has flushed all audio data
      setIsRecording(false);
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  };
}
