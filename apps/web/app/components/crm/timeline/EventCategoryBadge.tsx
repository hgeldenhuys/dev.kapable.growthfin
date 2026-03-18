/**
 * EventCategoryBadge Component
 * Displays event category with distinct colors
 */

import { Badge } from '~/components/ui/badge';
import { Mail, Milestone, Database, Cog, Shield } from 'lucide-react';

type EventCategory = 'communication' | 'milestone' | 'data' | 'system' | 'compliance';

interface EventCategoryBadgeProps {
  category: EventCategory;
}

const CATEGORY_CONFIG = {
  communication: {
    label: 'Communication',
    icon: Mail,
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300',
  },
  milestone: {
    label: 'Milestone',
    icon: Milestone,
    className: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300',
  },
  data: {
    label: 'Data Change',
    icon: Database,
    className: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300',
  },
  system: {
    label: 'System',
    icon: Cog,
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300',
  },
  compliance: {
    label: 'Compliance',
    icon: Shield,
    className: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300',
  },
} as const;

export function EventCategoryBadge({ category }: EventCategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
