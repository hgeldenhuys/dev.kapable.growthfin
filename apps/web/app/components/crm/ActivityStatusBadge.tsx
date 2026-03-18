/**
 * ActivityStatusBadge Component
 * Display activity status with color coding
 */

import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

interface ActivityStatusBadgeProps {
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  className?: string;
}

const STATUS_CONFIG = {
  planned: { label: 'Planned', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
};

export function ActivityStatusBadge({ status, className }: ActivityStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
