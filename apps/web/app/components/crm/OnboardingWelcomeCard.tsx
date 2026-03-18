/**
 * OnboardingWelcomeCard Component
 * Dashboard welcome card with step-by-step onboarding progress tracking.
 * Dismissible and auto-hides when all steps are complete.
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { CheckCircle2, X, ArrowRight, BookOpen } from 'lucide-react';

interface OnboardingWelcomeCardProps {
  workspaceId: string;
  counts: {
    leads: number;
    contacts: number;
    templates: number;
    campaigns: number;
    activities: number;
    opportunities: number;
  };
}

interface OnboardingStep {
  label: string;
  path: string;
  isComplete: boolean;
}

export function OnboardingWelcomeCard({ workspaceId, counts }: OnboardingWelcomeCardProps) {
  const dismissKey = `onboarding-welcome-dismissed-${workspaceId}`;
  const guideKey = `onboarding-guide-visited-${workspaceId}`;

  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(dismissKey) === 'true';
  });

  const [guideVisited, setGuideVisited] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(guideKey) === 'true';
  });

  const wid = workspaceId;

  const steps: OnboardingStep[] = useMemo(
    () => [
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
    ],
    [wid, counts, guideVisited],
  );

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

  const handleDismiss = useCallback(() => {
    localStorage.setItem(dismissKey, 'true');
    setIsDismissed(true);
  }, [dismissKey]);

  const handleGuideClick = useCallback(() => {
    localStorage.setItem(guideKey, 'true');
    setGuideVisited(true);
  }, [guideKey]);

  // Don't render if dismissed or all complete
  if (isDismissed || allComplete) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Welcome to GrowthFin</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium">
              {completedCount}/{totalSteps} steps done
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss welcome card"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="flex items-center gap-2.5 py-1.5"
            >
              {step.isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary shrink-0">
                  {index + 1}
                </span>
              )}

              <span
                className={
                  step.isComplete
                    ? 'text-sm text-muted-foreground line-through'
                    : 'text-sm'
                }
              >
                {step.label}
              </span>

              {!step.isComplete && (
                <Link
                  to={step.path}
                  onClick={
                    step.label === 'Read the guide'
                      ? handleGuideClick
                      : undefined
                  }
                  className="ml-auto inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                >
                  Go
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-primary/10">
          <Link
            to={`/dashboard/${wid}/docs/getting-started`}
            onClick={handleGuideClick}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            View the full Getting Started guide
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
