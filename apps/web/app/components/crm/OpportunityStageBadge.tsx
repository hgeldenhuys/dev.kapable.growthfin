/**
 * OpportunityStageBadge Component
 * Color-coded badges for opportunity stages
 */

import { Badge } from '~/components/ui/badge';

interface OpportunityStageBadgeProps {
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | 'abandoned';
}

const stageConfig = {
  prospecting: {
    label: 'Prospecting',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  },
  qualification: {
    label: 'Qualification',
    variant: 'secondary' as const,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  },
  proposal: {
    label: 'Proposal',
    variant: 'secondary' as const,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  },
  negotiation: {
    label: 'Negotiation',
    variant: 'secondary' as const,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  },
  closed_won: {
    label: 'Closed Won',
    variant: 'secondary' as const,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  },
  closed_lost: {
    label: 'Closed Lost',
    variant: 'secondary' as const,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  },
  abandoned: {
    label: 'Abandoned',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

export function OpportunityStageBadge({ stage }: OpportunityStageBadgeProps) {
  const config = stageConfig[stage];

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
