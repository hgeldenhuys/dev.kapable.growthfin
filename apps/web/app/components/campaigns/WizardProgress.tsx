/**
 * Wizard Progress Component
 * Shows step indicator for campaign creation wizard
 */

import { Check } from 'lucide-react';

interface WizardProgressProps {
  currentStep: number;
  steps: { title: string; description: string }[];
}

export function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;
          const isUpcoming = currentStep < stepNumber;

          return (
            <li key={step.title} className="md:flex-1">
              <div
                className={`group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 ${
                  isComplete
                    ? 'border-green-600'
                    : isCurrent
                    ? 'border-blue-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="text-sm font-medium">
                  {isComplete ? (
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-green-600">Step {stepNumber}</span>
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 text-blue-600">
                        {stepNumber}
                      </span>
                      <span className="text-blue-600">Step {stepNumber}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400">
                        {stepNumber}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">Step {stepNumber}</span>
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold mt-1 ml-8">{step.title}</span>
                <span className="text-xs text-muted-foreground ml-8">{step.description}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
