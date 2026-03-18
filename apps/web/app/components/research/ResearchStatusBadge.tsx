/**
 * Research Status Badge Component
 * Color-coded badge for research session status
 */

import { Badge } from '~/components/ui/badge';

interface ResearchStatusBadgeProps {
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';
  className?: string;
}

export function ResearchStatusBadge({ status, className }: ResearchStatusBadgeProps) {
  const variants = {
    pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    running: { label: 'Running', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 animate-pulse' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    stopped: { label: 'Stopped', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  };

  const config = variants[status] || variants.pending;

  return (
    <Badge className={`${config.className} ${className || ''}`}>
      {config.label}
    </Badge>
  );
}
