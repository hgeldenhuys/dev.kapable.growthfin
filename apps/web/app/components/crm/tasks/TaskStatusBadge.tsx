/**
 * TaskStatusBadge Component
 * Status badge for task visualization with consistent color coding
 */

import { Badge } from '~/components/ui/badge';
import { CheckCircle, Clock, PlayCircle, XCircle, BanIcon, Calendar } from 'lucide-react';

interface TaskStatusBadgeProps {
  status: 'planned' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  className?: string;
}

const statusConfig = {
  planned: {
    label: 'Planned',
    variant: 'default' as const,
    className: 'bg-blue-500 text-white hover:bg-blue-600',
    icon: Clock,
  },
  scheduled: {
    label: 'Scheduled',
    variant: 'default' as const,
    className: 'bg-purple-500 text-white hover:bg-purple-600',
    icon: Calendar,
  },
  running: {
    label: 'Running',
    variant: 'default' as const,
    className: 'bg-yellow-500 text-white hover:bg-yellow-600',
    icon: PlayCircle,
  },
  completed: {
    label: 'Completed',
    variant: 'default' as const,
    className: 'bg-green-500 text-white hover:bg-green-600',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    variant: 'default' as const,
    className: 'bg-red-500 text-white hover:bg-red-600',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'default' as const,
    className: 'bg-gray-500 text-white hover:bg-gray-600',
    icon: BanIcon,
  },
};

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} ${className || ''}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
