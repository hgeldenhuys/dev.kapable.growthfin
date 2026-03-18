import { useEffect } from 'react';
import { toast } from 'sonner';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
}

/**
 * Hook for managing keyboard shortcuts with context awareness
 * - Shortcuts only work when not typing in input/textarea/contenteditable
 * - Shows toast feedback when shortcuts are activated
 * - Prevents default browser behavior for registered shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const keyMatches = e.key === shortcut.key;
        const ctrlMatches = e.ctrlKey === (shortcut.ctrlKey ?? false);
        const shiftMatches = e.shiftKey === (shortcut.shiftKey ?? false);
        const metaMatches = e.metaKey === (shortcut.metaKey ?? false);

        if (keyMatches && ctrlMatches && shiftMatches && metaMatches) {
          e.preventDefault();
          shortcut.action();

          // Show toast feedback
          toast.info(shortcut.description, { duration: 1000 });
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
