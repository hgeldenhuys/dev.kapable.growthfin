/**
 * Work Item Status Badge Component (UI-001)
 * Color-coded badge for work item status with optional icon
 */

import { Badge } from '~/components/ui/badge';
import {
  Clock,
  UserCheck,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import type { WorkItemStatus } from '@agios/db';

interface WorkItemStatusBadgeProps {
  status: WorkItemStatus;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<WorkItemStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  icon: typeof Clock;
  colors: string;
}> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
    icon: Clock,
    colors: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300',
  },
  claimed: {
    label: 'Claimed',
    variant: 'default',
    icon: UserCheck,
    colors: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default',
    icon: Loader2,
    colors: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-300',
  },
  completed: {
    label: 'Completed',
    variant: 'secondary',
    icon: CheckCircle,
    colors: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300',
  },
  expired: {
    label: 'Expired',
    variant: 'destructive',
    icon: AlertCircle,
    colors: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    icon: XCircle,
    colors: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function WorkItemStatusBadge({
  status,
  className,
  showIcon = true,
  size = 'md',
}: WorkItemStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.colors} ${sizeClasses[size]} ${className || ''}`}
    >
      {showIcon && (
        <Icon
          className={`${iconSizes[size]} mr-1 ${status === 'in_progress' ? 'animate-spin' : ''}`}
        />
      )}
      {config.label}
    </Badge>
  );
}
