/**
 * LeadScoreBadge Component
 * Display propensity score with color coding and emoji icons
 *
 * Color scheme:
 * - Hot (80-100): Red/Orange (🔥)
 * - Warm (50-79): Yellow (⚡)
 * - Cold (0-49): Blue/Gray (❄️)
 */

import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

interface LeadScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function LeadScoreBadge({
  score,
  size = 'md',
  showIcon = true,
  showLabel = false,
  className,
}: LeadScoreBadgeProps) {
  // Determine temperature category
  const getScoreCategory = () => {
    if (score >= 80) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  };

  const category = getScoreCategory();

  // Get icon for category
  const getIcon = () => {
    switch (category) {
      case 'hot':
        return '🔥';
      case 'warm':
        return '⚡';
      case 'cold':
        return '❄️';
      default:
        return '';
    }
  };

  // Get label for category
  const getLabel = () => {
    switch (category) {
      case 'hot':
        return 'Hot';
      case 'warm':
        return 'Warm';
      case 'cold':
        return 'Cold';
      default:
        return '';
    }
  };

  // Get color classes for category
  const getColorClasses = () => {
    switch (category) {
      case 'hot':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300 dark:border-red-700';
      case 'warm':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'cold':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';
    }
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-0.5';
      case 'lg':
        return 'text-base px-3 py-1';
      case 'md':
      default:
        return 'text-sm px-2.5 py-0.5';
    }
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold border',
        getColorClasses(),
        getSizeClasses(),
        className
      )}
    >
      {showIcon && <span className="mr-1">{getIcon()}</span>}
      {showLabel ? getLabel() : score}
    </Badge>
  );
}

/**
 * Get score category for filtering and logic
 */
export function getScoreCategory(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'warm';
  return 'cold';
}

/**
 * Get score range for filtering
 */
export function getScoreRange(category: 'hot' | 'warm' | 'cold'): [number, number] {
  switch (category) {
    case 'hot':
      return [80, 100];
    case 'warm':
      return [50, 79];
    case 'cold':
      return [0, 49];
  }
}
