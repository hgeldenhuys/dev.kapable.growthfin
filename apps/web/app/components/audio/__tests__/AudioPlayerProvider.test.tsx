import { describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { AudioPlayerProvider, useAudioPlayer } from '../AudioPlayerProvider';
import type { ReactNode } from 'react';

describe('AudioPlayerProvider', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AudioPlayerProvider>{children}</AudioPlayerProvider>
  );

  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should provide initial state', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    expect(result.current.queue).toEqual([]);
    expect(result.current.currentTrack).toBeNull();
    expect(result.current.playbackState).toBe('idle');
    expect(result.current.volume).toBe(1);
    expect(result.current.position).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isPanelOpen).toBe(false);
  });

  it('should add items to queue', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    act(() => {
      result.current.addToQueue({
        messageId: 'msg-1',
        messagePreview: 'Test message 1',
        audioUrl: 'https://example.com/audio1.mp3',
      });
    });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].messageId).toBe('msg-1');
  });

  it('should remove items from queue', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    act(() => {
      result.current.addToQueue({
        messageId: 'msg-1',
        messagePreview: 'Test message 1',
        audioUrl: 'https://example.com/audio1.mp3',
      });
      result.current.addToQueue({
        messageId: 'msg-2',
        messagePreview: 'Test message 2',
        audioUrl: 'https://example.com/audio2.mp3',
      });
    });

    expect(result.current.queue).toHaveLength(2);

    const itemId = result.current.queue[0].id;

    act(() => {
      result.current.removeFromQueue(itemId);
    });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].messageId).toBe('msg-2');
  });

  it('should clear queue', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    act(() => {
      result.current.addToQueue({
        messageId: 'msg-1',
        messagePreview: 'Test message 1',
        audioUrl: 'https://example.com/audio1.mp3',
      });
      result.current.addToQueue({
        messageId: 'msg-2',
        messagePreview: 'Test message 2',
        audioUrl: 'https://example.com/audio2.mp3',
      });
    });

    expect(result.current.queue).toHaveLength(2);

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queue).toEqual([]);
    expect(result.current.currentTrack).toBeNull();
    expect(result.current.playbackState).toBe('idle');
  });

  it('should enforce max queue size', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    // Add 51 items (max is 50)
    act(() => {
      for (let i = 0; i < 51; i++) {
        result.current.addToQueue({
          messageId: `msg-${i}`,
          messagePreview: `Test message ${i}`,
          audioUrl: `https://example.com/audio${i}.mp3`,
        });
      }
    });

    expect(result.current.queue.length).toBeLessThanOrEqual(50);
  });

  it('should persist volume to localStorage', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(result.current.volume).toBe(0.5);
    expect(localStorage.getItem('agios-audio-player-volume')).toBe('0.5');
  });

  it('should toggle panel state', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    expect(result.current.isPanelOpen).toBe(false);

    act(() => {
      result.current.togglePanel();
    });

    expect(result.current.isPanelOpen).toBe(true);

    act(() => {
      result.current.togglePanel();
    });

    expect(result.current.isPanelOpen).toBe(false);
  });
});
