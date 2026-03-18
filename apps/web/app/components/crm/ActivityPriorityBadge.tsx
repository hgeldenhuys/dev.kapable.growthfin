/**
 * ActivityPriorityBadge Component
 * Display activity priority with color coding
 */

import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

interface ActivityPriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  className?: string;
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
};

export function ActivityPriorityBadge({ priority, className }: ActivityPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
