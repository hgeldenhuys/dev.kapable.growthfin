/**
 * SessionStatusBadge Component
 * Visual health indicator for Claude Code sessions
 */

import { Badge } from "../ui/badge";

export type SessionStatus = 'active' | 'warning' | 'stale' | 'archived';

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

const statusConfig = {
  active: {
    label: 'Active',
    variant: 'default' as const,
    className: 'bg-green-500 hover:bg-green-600 text-white',
    icon: '🟢',
  },
  warning: {
    label: 'Warning',
    variant: 'default' as const,
    className: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    icon: '🟡',
  },
  stale: {
    label: 'Stale',
    variant: 'default' as const,
    className: 'bg-red-500 hover:bg-red-600 text-white',
    icon: '🔴',
  },
  archived: {
    label: 'Archived',
    variant: 'secondary' as const,
    className: 'bg-gray-500 hover:bg-gray-600 text-white',
    icon: '⚫',
  },
};

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={config.className}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
