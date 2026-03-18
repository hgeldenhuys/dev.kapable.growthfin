/**
 * ActivityTypeBadge Component
 * Display activity type with icon and color
 */

import { CheckSquare, Phone, Mail, Calendar } from 'lucide-react';
import { Badge } from '~/components/ui/badge';

interface ActivityTypeBadgeProps {
  type: 'task' | 'call' | 'email' | 'meeting';
  className?: string;
}

const ACTIVITY_TYPE_CONFIG = {
  task: { icon: CheckSquare, label: 'Task', variant: 'default' as const },
  call: { icon: Phone, label: 'Call', variant: 'secondary' as const },
  email: { icon: Mail, label: 'Email', variant: 'outline' as const },
  meeting: { icon: Calendar, label: 'Meeting', variant: 'secondary' as const },
};

export function ActivityTypeBadge({ type, className }: ActivityTypeBadgeProps) {
  const config = ACTIVITY_TYPE_CONFIG[type];

  // Handle unknown activity types gracefully
  if (!config) {
    return (
      <Badge variant="default" className={className}>
        {type || 'Unknown'}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
