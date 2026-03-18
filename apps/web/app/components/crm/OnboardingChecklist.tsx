/**
 * OnboardingChecklist Component
 * Collapsible sidebar widget showing onboarding progress.
 * Fetches progress from the CRM API and tracks state in localStorage.
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, X, ChevronDown, BookOpen, PartyPopper } from 'lucide-react';
import { useOnboardingProgress } from '~/hooks/useOnboardingProgress';
import { cn } from '~/lib/utils';

interface OnboardingChecklistProps {
  workspaceId: string;
}

interface ChecklistStep {
  label: string;
  path: string;
  isComplete: boolean;
}

export function OnboardingChecklist({ workspaceId }: OnboardingChecklistProps) {
  const collapsedKey = `onboarding-checklist-collapsed-${workspaceId}`;
  const dismissedKey = `onboarding-checklist-dismissed-${workspaceId}`;
  const guideKey = `onboarding-guide-visited-${workspaceId}`;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(collapsedKey) === 'true';
  });

  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(dismissedKey) === 'true';
  });

  const [guideVisited, setGuideVisited] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(guideKey) === 'true';
  });

  const { data: progress } = useOnboardingProgress(workspaceId);

  const wid = workspaceId;

  const steps: ChecklistStep[] = useMemo(() => {
    const counts = progress ?? {
      leads: 0,
      contacts: 0,
      templates: 0,
      campaigns: 0,
      activities: 0,
      opportunities: 0,
    };

    return [
      {
        label: 'Create a lead',
        path: `/dashboard/${wid}/crm/leads`,
        isComplete: counts.leads > 0,
      },
      {
        label: 'Create a contact',
        path: `/dashboard/${wid}/crm/contacts`,
        isComplete: counts.contacts > 0,
      },
      {
        label: 'Create a template',
        path: `/dashboard/${wid}/crm/templates`,
        isComplete: counts.templates > 0,
      },
      {
        label: 'Create a campaign',
        path: `/dashboard/${wid}/crm/campaigns`,
        isComplete: counts.campaigns > 0,
      },
      {
        label: 'Log an activity',
        path: `/dashboard/${wid}/crm/activities`,
        isComplete: counts.activities > 0,
      },
      {
        label: 'Create an opportunity',
        path: `/dashboard/${wid}/crm/opportunities`,
        isComplete: counts.opportunities > 0,
      },
      {
        label: 'Read the guide',
        path: `/dashboard/${wid}/docs/getting-started`,
        isComplete: guideVisited,
      },
    ];
  }, [wid, progress, guideVisited]);

  const completedCount = useMemo(() => {
    let count = 0;
    for (const step of steps) {
      if (step.isComplete) count++;
    }
    return count;
  }, [steps]);

  const totalSteps = steps.length;
  const allComplete = completedCount === totalSteps;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(collapsedKey, String(next));
      return next;
    });
  }, [collapsedKey]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(dismissedKey, 'true');
    setIsDismissed(true);
  }, [dismissedKey]);

  const handleGuideClick = useCallback(() => {
    localStorage.setItem(guideKey, 'true');
    setGuideVisited(true);
  }, [guideKey]);

  // Don't render if permanently dismissed
  if (isDismissed) return null;

  // Collapsed view
  if (isCollapsed || allComplete) {
    return (
      <button
        type="button"
        onClick={allComplete ? handleDismiss : toggleCollapsed}
        className={cn(
          'mx-2 mb-2 flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-xs transition-colors hover:bg-muted/50',
          allComplete && 'border-green-500/30 bg-green-500/5',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0',
            allComplete
              ? 'bg-green-500/20 text-green-600'
              : 'bg-primary/10 text-primary',
          )}
        >
          {completedCount}/{totalSteps}
        </span>
        {allComplete ? (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <PartyPopper className="h-3 w-3" />
            All done!
          </span>
        ) : (
          <span className="text-muted-foreground">Setup Progress</span>
        )}
      </button>
    );
  }

  // Expanded view
  return (
    <div className="mx-2 mb-2 rounded-lg border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <span className="text-xs font-medium">Setup Progress</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Collapse checklist"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Dismiss checklist"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-3 mt-2 h-1 rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="px-3 mt-1 text-[10px] text-muted-foreground">
        {completedCount}/{totalSteps} complete
      </div>

      {/* Steps */}
      <div className="px-3 py-2 space-y-1">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2 py-0.5">
            {step.isComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary shrink-0">
                {index + 1}
              </span>
            )}

            {step.isComplete ? (
              <span className="text-xs text-muted-foreground line-through">
                {step.label}
              </span>
            ) : (
              <Link
                to={step.path}
                onClick={
                  step.label === 'Read the guide'
                    ? handleGuideClick
                    : undefined
                }
                className="text-xs hover:text-primary hover:underline transition-colors"
              >
                {step.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2">
        <Link
          to={`/dashboard/${wid}/docs/getting-started`}
          onClick={handleGuideClick}
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <BookOpen className="h-3 w-3" />
          View full guide
        </Link>
      </div>
    </div>
  );
}
