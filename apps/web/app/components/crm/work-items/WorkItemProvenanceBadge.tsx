/**
 * Work Item Provenance Badge Component (UI-001)
 * Displays source information with icon and optional progress
 */

import { Badge } from '~/components/ui/badge';
import {
  CheckSquare,
  Megaphone,
  Workflow,
  User,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { useWorkItemProvenance } from '~/hooks/useWorkItemProvenance';
import type { SourceType } from '@agios/db';

interface WorkItemProvenanceBadgeProps {
  sourceType: SourceType | null | undefined;
  sourceId: string | null | undefined;
  workspaceId: string;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sourceConfig: Record<SourceType, {
  label: string;
  icon: typeof CheckSquare;
  colors: string;
}> = {
  batch: {
    label: 'Batch',
    icon: CheckSquare,
    colors: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  campaign: {
    label: 'Campaign',
    icon: Megaphone,
    colors: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  workflow: {
    label: 'Workflow',
    icon: Workflow,
    colors: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  manual: {
    label: 'Manual',
    icon: User,
    colors: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  },
  state_machine: {
    label: 'State Machine',
    icon: GitBranch,
    colors: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
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

export function WorkItemProvenanceBadge({
  sourceType,
  sourceId,
  workspaceId,
  showProgress = true,
  size = 'md',
  className,
}: WorkItemProvenanceBadgeProps) {
  const { progress, batch, campaign, isLoading } = useWorkItemProvenance(
    workspaceId,
    sourceType,
    sourceId,
    { enabled: showProgress && !!sourceType && !!sourceId }
  );

  // No provenance tracking
  if (!sourceType) {
    return null;
  }

  const config = sourceConfig[sourceType];
  const Icon = config.icon;

  // Get source name if available
  let sourceName = config.label;
  if (sourceType === 'batch' && batch.data?.name) {
    sourceName = batch.data.name;
  } else if (sourceType === 'campaign' && campaign.data?.name) {
    sourceName = campaign.data.name;
  }

  // Build progress text
  let progressText = '';
  if (showProgress && progress.data) {
    const { completed, total } = progress.data;
    if (total > 0) {
      progressText = ` (${completed}/${total})`;
    }
  }

  return (
    <Badge
      variant="outline"
      className={`${config.colors} ${sizeClasses[size]} ${className || ''}`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} mr-1 animate-spin`} />
      ) : (
        <Icon className={`${iconSizes[size]} mr-1`} />
      )}
      <span className="truncate max-w-[150px]">{sourceName}</span>
      {progressText && (
        <span className="ml-1 font-mono text-xs opacity-75">{progressText}</span>
      )}
    </Badge>
  );
}
