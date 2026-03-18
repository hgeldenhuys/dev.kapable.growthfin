/**
 * useUnsavedChanges Hook
 * Warns users about unsaved changes when navigating away
 */

import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router';

export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Browser navigation warning (refresh, close tab, etc.)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers ignore custom messages
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return blocker;
}
