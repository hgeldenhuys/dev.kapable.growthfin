/**
 * Campaign Status Badge Component
 * Color-coded badge for campaign status
 */

import { Badge } from '~/components/ui/badge';

interface CampaignStatusBadgeProps {
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  className?: string;
}

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const variants = {
    draft: { label: 'Draft', variant: 'secondary' as const },
    scheduled: { label: 'Scheduled', variant: 'default' as const },
    active: { label: 'Active', variant: 'default' as const },
    paused: { label: 'Paused', variant: 'secondary' as const },
    completed: { label: 'Completed', variant: 'outline' as const },
    cancelled: { label: 'Cancelled', variant: 'destructive' as const },
  };

  const config = variants[status] || variants.draft;

  const customColors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <Badge data-testid="campaign-status-badge" className={`${customColors[status]} ${className || ''}`}>
      {config.label}
    </Badge>
  );
}
