/**
 * KYC Status Badge Component
 * Visual indicator for FICA KYC verification status
 */

import { Badge } from '~/components/ui/badge';
import { Clock, Eye, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface KYCStatusBadgeProps {
  status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
  className?: string;
}

export function KYCStatusBadge({ status, className }: KYCStatusBadgeProps) {
  const variants = {
    pending: {
      label: 'Pending',
      variant: 'outline' as const,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      icon: Clock,
    },
    in_review: {
      label: 'In Review',
      variant: 'default' as const,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      icon: Eye,
    },
    verified: {
      label: 'Verified',
      variant: 'default' as const,
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      icon: XCircle,
    },
    expired: {
      label: 'Expired',
      variant: 'secondary' as const,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      icon: AlertTriangle,
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
