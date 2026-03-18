/**
 * useFormDraft Hook
 * Auto-save form drafts to localStorage with 7-day expiration
 */

import { useState, useEffect, useCallback } from 'react';

interface FormDraft<T> {
  data: T;
  timestamp: number;
}

export function useFormDraft<T>(key: string, initialData: T) {
  const storageKey = `form-draft-${key}`;
  const [data, setData] = useState<T>(initialData);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<number>(0);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: FormDraft<T> = JSON.parse(stored);
        const age = Date.now() - draft.timestamp;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (age < sevenDays) {
          setHasDraft(true);
          setDraftTimestamp(draft.timestamp);
        } else {
          // Expired - remove it
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  }, [storageKey]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const draft: FormDraft<T> = {
          data,
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [data, storageKey]);

  const resumeDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: FormDraft<T> = JSON.parse(stored);
        setData(draft.data);
        setHasDraft(false);
      }
    } catch (error) {
      console.error('Failed to resume draft:', error);
    }
  }, [storageKey]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    data,
    setData,
    hasDraft,
    draftTimestamp,
    resumeDraft,
    discardDraft,
    clearDraft,
  };
}
