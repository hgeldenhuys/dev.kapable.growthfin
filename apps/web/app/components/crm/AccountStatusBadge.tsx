/**
 * Account Status Badge Component
 * Color-coded badge for account status
 */

import { Badge } from '~/components/ui/badge';

interface AccountStatusBadgeProps {
  status: 'active' | 'inactive';
  className?: string;
}

export function AccountStatusBadge({ status, className }: AccountStatusBadgeProps) {
  const variants = {
    active: { label: 'Active', variant: 'default' as const },
    inactive: { label: 'Inactive', variant: 'secondary' as const },
  };

  const config = variants[status] || variants.active;

  const customColors = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <Badge className={`${customColors[status]} ${className || ''}`}>
      {config.label}
    </Badge>
  );
}
