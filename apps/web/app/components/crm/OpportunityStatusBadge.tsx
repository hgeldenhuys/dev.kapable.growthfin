/**
 * OpportunityStatusBadge Component
 * Color-coded badges for opportunity status
 */

import { Badge } from '~/components/ui/badge';

interface OpportunityStatusBadgeProps {
  status: 'open' | 'won' | 'lost' | 'abandoned';
}

const statusConfig = {
  open: {
    label: 'Open',
    variant: 'secondary' as const,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  },
  won: {
    label: 'Won',
    variant: 'secondary' as const,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  },
  lost: {
    label: 'Lost',
    variant: 'secondary' as const,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  },
  abandoned: {
    label: 'Abandoned',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

export function OpportunityStatusBadge({ status }: OpportunityStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
