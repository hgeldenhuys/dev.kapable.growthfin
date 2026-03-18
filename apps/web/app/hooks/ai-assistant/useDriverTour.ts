/**
 * Driver.js Tour Hook
 * Executes highlight and tour actions from AI assistant responses
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DriverAction } from '../../lib/api/ai-assistant';

export type { DriverAction };

export function useDriverTour() {
  const driverRef = useRef<any>(null);

  useEffect(() => {
    // Lazy load driver.js client-side only (CSS imported globally in root.tsx)
    import('driver.js').then(({ driver }) => {
      driverRef.current = driver;
    });
  }, []);

  const executeAction = useCallback((action: DriverAction) => {
    if (!driverRef.current) return;

    if (action.type === 'highlight' && action.selector) {
      // Check element exists before highlighting
      const el = document.querySelector(action.selector);
      if (!el) {
        console.warn(`[useDriverTour] Element not found: ${action.selector}`);
        return;
      }

      const driverObj = driverRef.current({
        animate: true,
        allowClose: true,
        overlayOpacity: 0.4,
        stagePadding: 8,
        popoverClass: 'ai-tour-popover',
      });
      driverObj.highlight({
        element: action.selector,
        popover: {
          title: action.title,
          description: action.body,
          side: action.position ?? 'bottom',
          align: 'start',
        },
      });
    }

    if (action.type === 'tour' && action.steps) {
      // Filter to only steps whose elements exist on the page
      const validSteps: any[] = [];
      for (const step of action.steps) {
        const el = document.querySelector(step.selector);
        if (el) {
          validSteps.push({
            element: step.selector,
            popover: {
              title: step.title,
              description: step.body,
              side: step.position ?? 'bottom',
            },
          });
        }
      }

      if (validSteps.length === 0) {
        console.warn('[useDriverTour] No valid tour elements found on page');
        return;
      }

      const driverObj = driverRef.current({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayOpacity: 0.4,
        stagePadding: 8,
        popoverClass: 'ai-tour-popover',
      });
      driverObj.setSteps(validSteps);
      driverObj.drive();
    }
  }, []);

  const executeActions = useCallback((actions: DriverAction[]) => {
    if (!actions || actions.length === 0) return;
    // Small delay to ensure UI has rendered after chat response
    setTimeout(() => {
      for (const action of actions) {
        executeAction(action);
      }
    }, 300);
  }, [executeAction]);

  return { executeAction, executeActions };
}
