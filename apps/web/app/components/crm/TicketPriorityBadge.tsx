/**
 * Ticket Priority Badge Component
 * Color-coded badge for ticket priority
 */

import { Badge } from '~/components/ui/badge';

type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TicketPriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

const priorityConfig: { [K in TicketPriority]: { label: string; colors: string } } = {
  low: { label: 'Low', colors: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  medium: { label: 'Medium', colors: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  high: { label: 'High', colors: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  urgent: { label: 'Urgent', colors: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
};

export function TicketPriorityBadge({ priority, className }: TicketPriorityBadgeProps) {
  const { label, colors } = priorityConfig[priority];

  return (
    <Badge className={`${colors} ${className || ''}`}>
      {label}
    </Badge>
  );
}
