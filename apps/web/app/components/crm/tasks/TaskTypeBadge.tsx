/**
 * TaskTypeBadge Component
 * Type badge for task visualization with consistent icons
 */

import { Badge } from '~/components/ui/badge';
import { Wand2, Download, Filter, TrendingUp } from 'lucide-react';

interface TaskTypeBadgeProps {
  type: 'enrichment' | 'export' | 'segmentation' | 'scoring';
  className?: string;
}

const typeConfig = {
  enrichment: {
    label: 'Enrichment',
    icon: Wand2,
    className: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  },
  export: {
    label: 'Export',
    icon: Download,
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
  segmentation: {
    label: 'Segmentation',
    icon: Filter,
    className: 'bg-green-100 text-green-700 hover:bg-green-200',
  },
  scoring: {
    label: 'Scoring',
    icon: TrendingUp,
    className: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  },
};

export function TaskTypeBadge({ type, className }: TaskTypeBadgeProps) {
  const config = typeConfig[type];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {type}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} ${className || ''}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
