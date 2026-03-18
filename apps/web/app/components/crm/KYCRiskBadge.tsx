/**
 * KYC Risk Rating Badge Component
 * Visual indicator for FICA risk assessment
 */

import { Badge } from '~/components/ui/badge';
import { AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

interface KYCRiskBadgeProps {
  riskRating: 'low' | 'medium' | 'high' | null;
  className?: string;
}

export function KYCRiskBadge({ riskRating, className }: KYCRiskBadgeProps) {
  if (!riskRating) {
    return (
      <Badge variant="outline" className={className}>
        <AlertCircle className="mr-1 h-3 w-3" />
        Not Assessed
      </Badge>
    );
  }

  const variants = {
    low: {
      label: 'Low Risk',
      variant: 'default' as const,
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      icon: AlertCircle,
    },
    medium: {
      label: 'Medium Risk',
      variant: 'outline' as const,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      icon: AlertTriangle,
    },
    high: {
      label: 'High Risk',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      icon: ShieldAlert,
    },
  };

  const config = variants[riskRating];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} ${className || ''}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
