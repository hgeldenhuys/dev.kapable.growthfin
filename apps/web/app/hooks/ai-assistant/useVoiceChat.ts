/**
 * Voice Chat Hook
 * Orchestrates recording → sending → TTS playback
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVoiceRecorder } from './useVoiceRecorder';
import { useRouteContext } from './useRouteContext';
import { useDriverTour } from './useDriverTour';
import { useAIChatStore } from '../../stores/aiChatStore';
import { sendVoiceMessage, fetchTTSAudio } from '../../lib/api/ai-assistant';

export interface UseVoiceChatOptions {
  workspaceId: string;
  userId: string;
}

export interface UseVoiceChatReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  isSpeakLoading: boolean;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  stopAndSend: () => Promise<void>;
  cancelRecording: () => void;
  speakMessage: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  voiceMode: boolean;
  toggleVoiceMode: () => void;
  recordingError: string | null;
}

export function useVoiceChat({ workspaceId, userId }: UseVoiceChatOptions): UseVoiceChatReturn {
  const queryClient = useQueryClient();
  const routeContext = useRouteContext();
  const { executeActions } = useDriverTour();
  const { voiceMode, toggleVoiceMode } = useAIChatStore();

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeakLoading, setIsSpeakLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const {
    isRecording,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    error: recordingError,
  } = useVoiceRecorder();

  // Clean up audio resources
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const stopAndSend = useCallback(async () => {
    try {
      const blob = await stopRecording();
      setIsTranscribing(true);

      const result = await sendVoiceMessage(workspaceId, userId, blob, {
        userId,
        ...routeContext,
      });

      // Invalidate conversation to show new messages
      queryClient.invalidateQueries({ queryKey: ['ai-conversation', workspaceId, userId] });

      // Execute driver actions
      if (result?.driver_actions?.length) {
        executeActions(result.driver_actions);
      }

      // Auto-read response if voice mode is on
      if (voiceMode && result?.content) {
        // Don't await — let it play in background
        speakMessage(result.content);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Voice message failed';
      toast.error('Voice message failed', { description: message });
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording, workspaceId, userId, routeContext, queryClient, executeActions, voiceMode]);

  const speakMessage = useCallback(async (text: string) => {
    // Stop any currently playing audio
    cleanupAudio();

    setIsSpeakLoading(true);
    try {
      const audioBlob = await fetchTTSAudio(workspaceId, text);
      const url = URL.createObjectURL(audioBlob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsSpeakLoading(false);
      };

      audio.onended = () => {
        cleanupAudio();
      };

      audio.onerror = () => {
        cleanupAudio();
        setIsSpeakLoading(false);
        toast.error('Audio playback failed');
      };

      await audio.play();
    } catch (err) {
      setIsSpeakLoading(false);
      cleanupAudio();
      const message = err instanceof Error ? err.message : 'TTS failed';
      toast.error('Text-to-speech failed', { description: message });
    }
  }, [workspaceId, cleanupAudio]);

  const stopSpeaking = useCallback(() => {
    cleanupAudio();
  }, [cleanupAudio]);

  return {
    isRecording,
    isTranscribing,
    isSpeaking,
    isSpeakLoading,
    recordingDuration,
    startRecording,
    stopAndSend,
    cancelRecording,
    speakMessage,
    stopSpeaking,
    voiceMode,
    toggleVoiceMode,
    recordingError,
  };
}
