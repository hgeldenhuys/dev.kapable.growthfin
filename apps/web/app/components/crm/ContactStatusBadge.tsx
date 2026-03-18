/**
 * Contact Status Badge Component
 * Color-coded badge for contact status
 */

import { Badge } from '~/components/ui/badge';

interface ContactStatusBadgeProps {
  status: 'active' | 'inactive' | 'do_not_contact';
  className?: string;
}

export function ContactStatusBadge({ status, className }: ContactStatusBadgeProps) {
  const variants = {
    active: { label: 'Active', variant: 'default' as const },
    inactive: { label: 'Inactive', variant: 'secondary' as const },
    do_not_contact: { label: 'Do Not Contact', variant: 'destructive' as const },
  };

  const config = variants[status] || variants.active;

  const customColors = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    do_not_contact: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <Badge className={`${customColors[status]} ${className || ''}`}>
      {config.label}
    </Badge>
  );
}
