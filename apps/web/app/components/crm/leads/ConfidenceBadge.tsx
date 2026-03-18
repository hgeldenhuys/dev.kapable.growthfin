/**
 * Confidence Badge Component
 * Visual indicator for classification confidence scores
 */

import { cn } from '~/lib/utils';

interface ConfidenceBadgeProps {
  value: number; // 0.0 to 1.0
  className?: string;
}

export function ConfidenceBadge({ value, className }: ConfidenceBadgeProps) {
  const percentage = Math.round(value * 100);

  // Color coding based on confidence level
  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (pct >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    if (pct >= 40) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        getColor(percentage),
        className
      )}
    >
      {percentage}%
    </span>
  );
}
