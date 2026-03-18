/**
 * Lead Status Badge Component
 * Color-coded badge for lead status
 */

import { Badge } from '~/components/ui/badge';

interface LeadStatusBadgeProps {
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const variants = {
    new: { label: 'New', variant: 'secondary' as const },
    contacted: { label: 'Contacted', variant: 'default' as const },
    qualified: { label: 'Qualified', variant: 'default' as const },
    unqualified: { label: 'Unqualified', variant: 'destructive' as const },
    converted: { label: 'Converted', variant: 'default' as const },
  };

  const config = variants[status] || variants.new;

  const customColors = {
    new: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    qualified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    unqualified: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  };

  return (
    <Badge className={`${customColors[status]} ${className || ''}`}>
      {config.label}
    </Badge>
  );
}
