/**
 * US-AI-013: Global Chat State Management
 * Zustand store for AI Chat Widget UI state
 */

import { create } from 'zustand';

interface AIChatStore {
  isOpen: boolean;
  isMinimized: boolean;
  voiceMode: boolean;
  toggle: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  open: () => void;
  toggleVoiceMode: () => void;
  setVoiceMode: (on: boolean) => void;
}

export const useAIChatStore = create<AIChatStore>((set) => ({
  isOpen: false,
  isMinimized: true,
  voiceMode: false,

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  minimize: () => set({ isMinimized: true }),

  maximize: () => set({ isOpen: true, isMinimized: false }),

  close: () => set({ isOpen: false, isMinimized: true }),

  open: () => set({ isOpen: true, isMinimized: false }),

  toggleVoiceMode: () => set((state) => ({ voiceMode: !state.voiceMode })),

  setVoiceMode: (on: boolean) => set({ voiceMode: on }),
}));
