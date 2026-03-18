/**
 * Consent Status Badge Component
 * Visual indicator for POPIA consent status
 */

import { Badge } from '~/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

interface ConsentStatusBadgeProps {
  status: 'granted' | 'revoked' | 'expired' | 'pending';
  className?: string;
}

export function ConsentStatusBadge({ status, className }: ConsentStatusBadgeProps) {
  const variants = {
    granted: {
      label: 'Granted',
      variant: 'default' as const,
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      icon: CheckCircle2,
    },
    revoked: {
      label: 'Revoked',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      icon: XCircle,
    },
    expired: {
      label: 'Expired',
      variant: 'secondary' as const,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      icon: Clock,
    },
    pending: {
      label: 'Pending',
      variant: 'outline' as const,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      icon: AlertCircle,
    },
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} ${className || ''}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
