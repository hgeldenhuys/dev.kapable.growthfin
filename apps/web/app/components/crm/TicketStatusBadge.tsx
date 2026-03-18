/**
 * Ticket Status Badge Component
 * Color-coded badge for ticket status
 */

import { Badge } from '~/components/ui/badge';

type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

const statusConfig: { [K in TicketStatus]: { label: string; colors: string } } = {
  open: { label: 'Open', colors: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  in_progress: { label: 'In Progress', colors: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  waiting: { label: 'Waiting', colors: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  resolved: { label: 'Resolved', colors: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  closed: { label: 'Closed', colors: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const { label, colors } = statusConfig[status];

  return (
    <Badge className={`${colors} ${className || ''}`}>
      {label}
    </Badge>
  );
}
